import { isNonEmptyString } from '@/core/guards'

type Poll<T> = () => Promise<T | null | undefined> | T | null | undefined

interface WaitForOptions {
  timeoutMs?: number
  intervalMs?: number
}

// The helper deadline must stay below the vitest testTimeout.
const WAIT_TIMEOUT_MS = isNonEmptyString(process.env.CI) ? 15_000 : 5_000

/**
 * Polls until `read` returns a truthy value.
 * Throws with the timeout when it never does.
 */
export async function waitFor<T>(read: Poll<T>, options: WaitForOptions = {}): Promise<T> {
  const { timeoutMs = WAIT_TIMEOUT_MS, intervalMs = 20 } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await read()

    if (value) {
      return value
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs)
    })
  }

  throw new Error(`Timed out after ${timeoutMs} ms`)
}
