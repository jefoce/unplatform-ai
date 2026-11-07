import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointToken: () => {
      return null
    },
  }
})

const { customRequest } = await import('@/server/providers/custom/http')

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'ep1',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: null,
  lastHealth: null,
}

/** Fetch that never resolves, rejects when its signal aborts, and reports that signal. */
function stubAbortableFetch(): () => AbortSignal | null | undefined {
  let received: AbortSignal | null | undefined = null

  const fetchMock = vi.fn((_url: URL, init: RequestInit) => {
    const signal = init.signal

    received = signal

    return new Promise<Response>((_resolve, reject) => {
      if (isNil(signal)) {
        reject(new Error('fetch called without a signal'))

        return
      }

      signal.addEventListener(
        'abort',
        () => {
          reject(signal.reason)
        },
        { once: true },
      )
    })
  })

  vi.stubGlobal('fetch', fetchMock)

  return () => {
    return received
  }
}

describe('customRequest abort signals', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aborts an in-flight request when the caller aborts', async () => {
    const controller = new AbortController()
    const received = stubAbortableFetch()

    const pending = customRequest({
      endpoint: ENDPOINT,
      path: '/health',
      init: { signal: controller.signal },
      timeoutMs: 10_000,
    })

    await Promise.resolve()
    controller.abort()

    const signal = received()

    expect(signal).not.toBe(controller.signal)
    expect(signal?.aborted).toBe(true)

    await expect(pending).rejects.toMatchObject({ code: 'timeout' })
  })

  it('rejects when only the timeout fires', async () => {
    const received = stubAbortableFetch()

    await expect(
      customRequest({
        endpoint: ENDPOINT,
        path: '/health',
        init: {},
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: 'timeout' })

    expect(received()?.aborted).toBe(true)
  })
})
