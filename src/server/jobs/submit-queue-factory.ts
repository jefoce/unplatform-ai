import 'server-only'

import { isNil } from 'lodash-es'

import { SUBMIT_QUEUE_CONCURRENCY, SUBMIT_YIELD_MS } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import { graceDelayMs } from '@/core/submit-state'

import { globalState } from '../global-state'
import { endpointQueueKey, getEndpointSync } from '../providers/custom/endpoint-source'
import { getMaxRunning } from '../services/endpoint-health'

export type SubmitStage = 'uploading' | 'sending'

export type SubmitOutcome = 'done' | 'requeue'

export type SubmitRunner = (id: string, signal: AbortSignal) => Promise<SubmitOutcome>

interface QueuedSubmit {
  stage: string
  notBefore?: string
}

interface QueuedSource {
  instanceId?: string
}

interface QueuedRecord {
  id: string
  status: string
  provider?: string
  source?: QueuedSource
  submit?: QueuedSubmit
}

interface PendingEntry {
  id: string
  key: string
}

interface ScheduleParams {
  id: string
  delayMs: number
  key: string
}

export interface SubmitQueueOptions {
  key: string
  load: (id: string) => Promise<QueuedRecord | null>
  list: () => Promise<QueuedRecord[]>
  maxConcurrent?: number
}

export interface SubmitQueue {
  configure(run: SubmitRunner | null): void
  isOwned(id: string): boolean
  sendingCount(): number
  setStage(id: string, stage: SubmitStage | null): void
  isStopped(): boolean
  start(id: string): Promise<void>
  resume(): Promise<void>
  cancel(id: string): void
  stop(): void
  waitForSendingDone(timeoutMs: number): Promise<boolean>
}

interface SubmitState {
  pending: Map<string, string>
  active: Map<string, string>
  timers: Map<string, NodeJS.Timeout>
  stages: Map<string, SubmitStage>
  controllers: Map<string, AbortController>
  runner: SubmitRunner | null
  closed: boolean
}

function createState(): SubmitState {
  return {
    pending: new Map(),
    active: new Map(),
    timers: new Map(),
    stages: new Map(),
    controllers: new Map(),
    runner: null,
    closed: false,
  }
}

/** One submit queue per key, so each record family has its own sets and timers. */
export function createSubmitQueue(options: SubmitQueueOptions): SubmitQueue {
  return new SubmitQueueImpl(options)
}

class SubmitQueueImpl implements SubmitQueue {
  private readonly state: SubmitState
  private readonly load: (id: string) => Promise<QueuedRecord | null>
  private readonly list: () => Promise<QueuedRecord[]>
  private readonly maxConcurrent: number

  constructor(options: SubmitQueueOptions) {
    const { key, load, list } = options

    this.state = globalState<SubmitState>(key, createState)
    this.load = load
    this.list = list
    this.maxConcurrent = options.maxConcurrent ?? SUBMIT_QUEUE_CONCURRENCY
  }

  configure(run: SubmitRunner | null): void {
    this.state.runner = run
  }

  isOwned(id: string): boolean {
    return this.state.timers.has(id) || this.state.pending.has(id) || this.state.active.has(id)
  }

  /** Pack instance for a custom endpoint, so two endpoints on one ComfyUI share a limit. */
  private queueKeyOf(record: QueuedRecord): string {
    if (record.provider !== 'custom') {
      return 'openrouter'
    }

    const endpointId = record.source?.instanceId

    if (!isNonEmptyString(endpointId)) {
      return 'custom'
    }

    const endpoint = getEndpointSync(endpointId)

    if (isNil(endpoint)) {
      return `custom:${endpointId}`
    }

    return `custom:${endpointQueueKey(endpoint)}`
  }

  private limitFor(key: string): number {
    if (!key.startsWith('custom:')) {
      return this.maxConcurrent
    }

    return getMaxRunning(key.slice('custom:'.length))
  }

  private activeCount(key: string): number {
    let count = 0

    for (const value of this.state.active.values()) {
      if (value === key) {
        count += 1
      }
    }

    return count
  }

  private nextPending(): PendingEntry | null {
    for (const [id, key] of this.state.pending) {
      if (this.activeCount(key) < this.limitFor(key)) {
        return { id, key }
      }
    }

    return null
  }

  /** Runs that already handed the request to the provider but await its reply. */
  sendingCount(): number {
    let count = 0

    for (const stage of this.state.stages.values()) {
      if (stage === 'sending') {
        count += 1
      }
    }

    return count
  }

  /** The runner marks each phase so shutdown can tell uploads from sends. */
  setStage(id: string, stage: SubmitStage | null): void {
    if (isNil(stage)) {
      this.state.stages.delete(id)
    } else {
      this.state.stages.set(id, stage)
    }
  }

  /** True after shutdown stopped the queue. No new submit may start. */
  isStopped(): boolean {
    return this.state.closed
  }

  /** Schedules an upload and submit after the grace window. */
  async start(id: string): Promise<void> {
    if (this.state.closed || this.isOwned(id)) {
      return
    }

    const record = await this.load(id)

    if (record?.status !== 'submitting' || record.submit?.stage !== 'grace') {
      return
    }

    this.schedule({
      id,
      delayMs: graceDelayMs(record.submit.notBefore),
      key: this.queueKeyOf(record),
    })
  }

  /** Reschedules the remaining grace windows after a process restart. */
  async resume(): Promise<void> {
    for (const record of await this.list()) {
      if (record.status === 'submitting' && record.submit?.stage === 'grace') {
        await this.start(record.id)
      }
    }
  }

  /** Clears a scheduled grace timer so a canceled record never submits. */
  cancel(id: string): void {
    const timer = this.state.timers.get(id)

    if (timer) {
      clearTimeout(timer)
      this.state.timers.delete(id)
    }

    this.state.pending.delete(id)
  }

  /** Closes the queue, clears grace timers and aborts uploads. Sends finish. */
  stop(): void {
    this.state.closed = true

    for (const timer of this.state.timers.values()) {
      clearTimeout(timer)
    }

    this.state.timers.clear()
    this.state.pending.clear()

    for (const [id, controller] of this.state.controllers) {
      if (this.state.stages.get(id) !== 'sending') {
        controller.abort()
      }
    }
  }

  /** Waits until no run is uploading or sending, or the timeout expires. */
  async waitForSendingDone(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs

    while (this.state.stages.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => {
        setTimeout(resolve, SUBMIT_YIELD_MS)
      })
    }

    return this.state.stages.size === 0
  }

  private schedule(params: ScheduleParams): void {
    const { id, delayMs, key } = params

    if (this.state.closed || this.isOwned(id)) {
      return
    }

    const timer = setTimeout(() => {
      this.state.timers.delete(id)
      this.state.pending.set(id, key)
      this.drain()
    }, delayMs)

    this.state.timers.set(id, timer)
  }

  private drain(): void {
    while (!this.state.closed) {
      const next = this.nextPending()

      if (isNil(next)) {
        return
      }

      const { id, key } = next

      this.state.pending.delete(id)
      this.state.active.set(id, key)
      const controller = new AbortController()

      this.state.controllers.set(id, controller)
      const runner = this.state.runner

      if (!runner) {
        console.error(`[unplatform-ai] no submit runner registered for ${id}`)
        this.state.active.delete(id)
        this.state.stages.delete(id)
        this.state.controllers.delete(id)
        continue
      }

      void runner(id, controller.signal)
        .catch((error): SubmitOutcome => {
          console.error(`[unplatform-ai] submit failed for ${id}`, error)

          return 'done'
        })
        .then((outcome) => {
          this.state.active.delete(id)
          this.state.stages.delete(id)
          this.state.controllers.delete(id)

          if (outcome === 'requeue') {
            void this.start(id)
          }

          this.drain()
        })
    }
  }
}
