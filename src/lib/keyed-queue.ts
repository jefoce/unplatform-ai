type KeyedTask = (isLast: () => boolean) => Promise<void>

interface QueueTail {
  promise: Promise<void>
  isLast: boolean
}

interface KeyedQueue {
  run: (key: string, task: KeyedTask) => Promise<void>
}

/** Serializes tasks per key in call order, dropping the entry once drained. */
export function createKeyedQueue(): KeyedQueue {
  const tails = new Map<string, QueueTail>()

  const run = (key: string, task: KeyedTask): Promise<void> => {
    const existing = tails.get(key)

    if (existing) {
      existing.isLast = false
    }

    const previous = existing?.promise ?? Promise.resolve()
    const tail: QueueTail = { promise: Promise.resolve(), isLast: true }

    tail.promise = previous
      .catch(() => {})
      .then(() => {
        return task(() => {
          return tail.isLast
        })
      })

    tails.set(key, tail)

    const clear = (): void => {
      if (tails.get(key) === tail) {
        tails.delete(key)
      }
    }

    void tail.promise.then(clear, clear)

    return tail.promise
  }

  return { run }
}
