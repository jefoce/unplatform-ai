import { describe, expect, it } from 'vitest'

import { createLimiter } from '@/server/sync/limiter'

describe('createLimiter concurrency', () => {
  it('never runs more than max tasks when a slot frees up', async () => {
    const limiter = createLimiter('test-limiter-peak', 1)
    let running = 0
    let peak = 0

    const task = (gate: Promise<void>) => {
      return async () => {
        running += 1
        peak = Math.max(peak, running)
        await gate
        running -= 1
      }
    }

    const first = Promise.withResolvers<void>()
    const a = limiter.run(task(first.promise))
    const b = limiter.run(task(Promise.resolve()))

    first.resolve()

    const c = Promise.resolve()
      .then(() => {})
      .then(() => {
        return limiter.run(task(Promise.resolve()))
      })

    await Promise.all([a, b, c])

    expect(peak).toBe(1)
  })

  it('keeps the peak at max with several queued tasks', async () => {
    const limiter = createLimiter('test-limiter-max-two', 2)
    const gate = Promise.withResolvers<void>()
    let running = 0
    let peak = 0

    const task = async () => {
      running += 1
      peak = Math.max(peak, running)
      await gate.promise
      running -= 1
    }

    const tasks = Array.from({ length: 6 }, () => {
      return limiter.run(task)
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(peak).toBe(2)

    gate.resolve()

    await Promise.all(tasks)
    expect(peak).toBe(2)
  })
})

describe('createLimiter queue order', () => {
  it('starts queued tasks in FIFO order', async () => {
    const limiter = createLimiter('test-limiter-fifo', 1)
    const first = Promise.withResolvers<void>()
    const started: string[] = []

    const task = (name: string, gate: Promise<void>) => {
      return async () => {
        started.push(name)
        await gate
      }
    }

    const a = limiter.run(task('a', first.promise))
    const b = limiter.run(task('b', Promise.resolve()))
    const c = limiter.run(task('c', Promise.resolve()))

    first.resolve()

    await Promise.all([a, b, c])

    expect(started).toEqual(['a', 'b', 'c'])
  })

  it('frees the slot when a task rejects', async () => {
    const limiter = createLimiter('test-limiter-reject', 1)
    const first = Promise.withResolvers<void>()
    let hasSecondStarted = false

    const failing = limiter.run(async () => {
      await first.promise

      throw new Error('boom')
    })

    const second = limiter.run(async () => {
      hasSecondStarted = true

      return 'ok'
    })

    first.resolve()

    await expect(failing).rejects.toThrow('boom')
    await expect(second).resolves.toBe('ok')
    expect(hasSecondStarted).toBe(true)
  })
})
