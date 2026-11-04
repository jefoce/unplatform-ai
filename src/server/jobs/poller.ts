import 'server-only'

import { POLL_INTERVAL_MS, POLL_PARALLEL } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import { ACTIVE_STATUSES } from '@/core/types'

import { globalState } from '../global-state'
import { sweepCompatFiles } from '../media/compat'
import { assertFfmpeg } from '../media/ffmpeg'
import { sweepThumbs } from '../media/thumbs'
import { cleanupStale, ensureDirs } from '../paths'
import { getGeneration, listActiveGenerations, updateGeneration } from '../repos/generations'
import { secretsReady } from '../secrets'
import { sweepRemote } from '../services/remote-inputs'
import { isDownloadQueued, stopDownloads } from './download-queue'
import { processRecord } from './poll-record'
import { interruptText, needsInterruptFail, reconcile } from './reconcile'

const SWEEP_INTERVAL_MS = 24 * 60 * 60_000

interface PollerState {
  timer: NodeJS.Timeout | null
  sweepTimer: NodeJS.Timeout | null
  sweepFirst: NodeJS.Timeout | null
  running: boolean
  started: boolean
  booted: boolean
  closed: boolean
}

const state = globalState<PollerState>('poller', () => {
  return {
    timer: null,
    sweepTimer: null,
    sweepFirst: null,
    running: false,
    started: false,
    booted: false,
    closed: false,
  }
})

/** Starts the singleton poller. A stopped poller never starts again. */
export function startPoller(): void {
  if (state.started || state.closed) {
    return
  }

  state.started = true

  void boot().catch((error) => {
    state.started = false
    console.error('[unplatform-ai] poller boot failed', error)
  })
}

/** True once boot finished: dirs, cleanup, reconcile and grace resume. */
export function isBooted(): boolean {
  return state.booted
}

/** Stops poll, sweep and download intake. Safe to call many times. */
export function stopPoller(): void {
  state.closed = true
  state.started = false
  state.booted = false

  if (state.timer) {
    clearInterval(state.timer)
  }

  if (state.sweepTimer) {
    clearInterval(state.sweepTimer)
  }

  if (state.sweepFirst) {
    clearTimeout(state.sweepFirst)
  }

  state.timer = null
  state.sweepTimer = null
  state.sweepFirst = null
  stopDownloads()
}

async function boot(): Promise<void> {
  await ensureDirs()
  await cleanupStale()
  assertFfmpeg()
  await reconcile()

  if (state.closed) {
    return
  }

  state.timer = setInterval(() => {
    return void tick()
  }, POLL_INTERVAL_MS)

  state.timer.unref()
  state.booted = true
  void tick()

  state.sweepFirst = setTimeout(() => {
    return void sweepUnusedRemote()
  }, 60_000)

  state.sweepFirst.unref()

  state.sweepTimer = setInterval(() => {
    return void sweepUnusedRemote()
  }, SWEEP_INTERVAL_MS)

  state.sweepTimer.unref()
}

/** Deletes remote objects and cache files unused for their retention window. */
async function sweepUnusedRemote(): Promise<void> {
  const { deleted, cleared, compat, thumbs } = await runSweeps()

  if (deleted > 0 || cleared > 0 || compat > 0 || thumbs > 0) {
    console.log(
      `[unplatform-ai] remote sweep deleted ${deleted}, cleared ${cleared}, compat ${compat}, thumbs ${thumbs}`,
    )
  }
}

interface SweepTotals {
  deleted: number
  cleared: number
  compat: number
  thumbs: number
}

/** Runs each sweep in its own try block so one failure never skips the others. */
export async function runSweeps(): Promise<SweepTotals> {
  let deleted = 0
  let cleared = 0
  let compat = 0
  let thumbs = 0

  try {
    const remote = await sweepRemote()

    deleted = remote.deleted
    cleared = remote.cleared
  } catch (error) {
    console.error('[unplatform-ai] remote sweep failed', error)
  }

  try {
    compat = await sweepCompatFiles()
  } catch (error) {
    console.error('[unplatform-ai] compat sweep failed', error)
  }

  try {
    thumbs = await sweepThumbs()
  } catch (error) {
    console.error('[unplatform-ai] thumbs sweep failed', error)
  }

  return { deleted, cleared, compat, thumbs }
}

async function tick(): Promise<void> {
  if (state.running) {
    return
  }

  state.running = true

  try {
    await secretsReady()
    const records = await listActiveGenerations()

    for (let i = 0; i < records.length; i += POLL_PARALLEL) {
      const chunk = records.slice(i, i + POLL_PARALLEL)

      await Promise.all(
        chunk.map((record) => {
          return processById(record.id).catch((error) => {
            console.error(`[unplatform-ai] poll failed for ${record.id}`, error)
          })
        }),
      )
    }
  } catch (error) {
    console.error('[unplatform-ai] poll tick failed', error)
  } finally {
    state.running = false
  }
}

/** Re-checks the fresh record inside the lock, so a stale snapshot never overwrites a job. */
export async function processById(id: string): Promise<void> {
  const record = await getGeneration(id)

  if (!record || !ACTIVE_STATUSES.includes(record.status)) {
    return
  }

  if (isDownloadQueued(id)) {
    return
  }

  if (!isNonEmptyString(record.job?.id)) {
    await updateGeneration(id, (latest) => {
      if (!needsInterruptFail(latest)) {
        return null
      }

      return {
        ...latest,
        status: 'failed',
        error: interruptText(latest),
        submit: undefined,
      }
    })

    return
  }

  await processRecord(record)
}
