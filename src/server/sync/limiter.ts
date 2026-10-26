import 'server-only'

import { globalState } from '../global-state'

interface LimiterState {
  active: number
  waiting: Array<() => void>
}

export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>
}

/** Runs at most `max` tasks at once. A finished task hands its slot straight to the next waiter. */
export function createLimiter(key: string, max: number): Limiter {
  const state = globalState<LimiterState>(key, () => {
    return { active: 0, waiting: [] }
  })

  async function acquire(): Promise<void> {
    if (state.active < max) {
      state.active += 1

      return
    }

    await new Promise<void>((resolve) => {
      state.waiting.push(resolve)
    })
  }

  function release(): void {
    const next = state.waiting.shift()

    if (next) {
      next()

      return
    }

    state.active -= 1
  }

  async function run<T>(task: () => Promise<T>): Promise<T> {
    await acquire()

    try {
      return await task()
    } finally {
      release()
    }
  }

  return { run }
}
