import 'server-only'

import { isNil } from 'lodash-es'

import { POLL_INTERVAL_MS, POLL_PARALLEL } from '@/core/constants'
import { ACTIVE_STATUSES } from '@/core/types'

import { globalState } from '../global-state'
import { sweepCompatFiles } from '../media/compat'
import { assertFfmpeg } from '../media/ffmpeg'
import { sweepThumbs } from '../media/thumbs'
import { cleanupStale, ensureDirs } from '../paths'
import { sweepRemote } from '../remote/remote-inputs'
import { getGeneration, listActiveGenerations, saveGeneration } from '../repos/generations'
import { secretsReady } from '../secrets'
import { isDownloadQueued, stopDownloads } from './download-queue'
import { withLock } from './lock'
import { processRecord } from './poll-record'
import { interruptText, needsInterruptFail, reconcile } from './reconcile'

export { needsInterruptFail } from './reconcile'

const SWEEP_INTERVAL_MS = 24 * 60 * 60_000

interface PollerState {
  timer: NodeJS.Timeout | null
  sweepTimer: NodeJS.Timeout | null
  sweepFirst: NodeJS.Timeout | null
  running: boolean
  started: boolean
  booted: boolean
  stopped: boolean
}
const state = globalState<PollerState>('poller', () => ({
  timer: null,
  sweepTimer: null,
  sweepFirst: null,
  running: false,
  started: false,
  booted: false,
  stopped: false,
}))

/** Starts the singleton poller. Safe to call many times. */
export function startPoller(): void {
  if (state.started) return

  state.started = true
  state.stopped = false
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
  state.stopped = true
  state.started = false
  state.booted = false

  if (state.timer) clearInterval(state.timer)

  if (state.sweepTimer) clearInterval(state.sweepTimer)

  if (state.sweepFirst) clearTimeout(state.sweepFirst)

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

  if (state.stopped) return

  state.timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
  state.timer.unref()
  state.booted = true
  void tick()

  state.sweepFirst = setTimeout(() => void sweepUnusedRemote(), 60_000)
  state.sweepFirst.unref()
  state.sweepTimer = setInterval(() => void sweepUnusedRemote(), SWEEP_INTERVAL_MS)
  state.sweepTimer.unref()
}

/** Deletes remote objects and cache files unused for their retention window. */
async function sweepUnusedRemote(): Promise<void> {
  try {
    const { deleted, cleared } = await sweepRemote()
    const compat = await sweepCompatFiles()
    const thumbs = await sweepThumbs()

    if (deleted > 0 || cleared > 0 || compat > 0 || thumbs > 0) {
      console.log(
        `[unplatform-ai] remote sweep deleted ${deleted}, cleared ${cleared}, compat ${compat}, thumbs ${thumbs}`,
      )
    }
  } catch (error) {
    console.error('[unplatform-ai] remote sweep failed', error)
  }
}

async function tick(): Promise<void> {
  if (state.running) return

  state.running = true

  try {
    await secretsReady()
    const records = await listActiveGenerations()

    for (let i = 0; i < records.length; i += POLL_PARALLEL) {
      const chunk = records.slice(i, i + POLL_PARALLEL)

      await Promise.all(
        chunk.map((record) =>
          withLock(record.id, () => processById(record.id)).catch((error) =>
            console.error(`[unplatform-ai] poll failed for ${record.id}`, error),
          ),
        ),
      )
    }
  } catch (error) {
    console.error('[unplatform-ai] poll tick failed', error)
  } finally {
    state.running = false
  }
}

/** Re-reads inside the lock so a concurrent favorite update is not overwritten. */
async function processById(id: string): Promise<void> {
  const record = await getGeneration(id)

  if (!record || !ACTIVE_STATUSES.includes(record.status)) return

  if (isDownloadQueued(id)) return

  if (isNil(record.job) || record.job.id === '') {
    if (needsInterruptFail(record)) {
      await saveGeneration({
        ...record,
        status: 'failed',
        error: interruptText(record),
        submit: undefined,
      })
    }

    return
  }

  await processRecord(record)
}
