import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CUSTOM_ERROR_RULES } from '@/core/presets/custom/errors'
import { UpaiErrorResponseSchema } from '@/core/protocol/upai'
import { friendlyError } from '@/core/provider-errors'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointToken: () => {
      return null
    },
  }
})

vi.mock('@/server/secrets', () => {
  return {
    secretsReady: async () => {},
  }
})

const { customRequest, providerErrorFromResponse } = await import('@/server/providers/custom/http')

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

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message, details: {} } }), { status })
}

describe('providerErrorFromResponse codes', () => {
  it('keeps insufficient_storage and maps it to the disk rule', async () => {
    const error = await providerErrorFromResponse(
      errorResponse(507, 'insufficient_storage', 'not enough free disk space'),
    )

    expect(error.code).toBe('insufficient_storage')
    expect(error.message).toBe('upai:insufficient_storage: not enough free disk space')

    const friendly = friendlyError({
      raw: error.storedMessage,
      rules: CUSTOM_ERROR_RULES,
      httpRules: null,
    })

    expect(friendly.title).toBe('ComfyUI is out of disk space.')
    expect(friendly.hint).toBe('Free space on the ComfyUI machine, then try again.')
    expect(friendly.kind).toBe('provider')
    expect(friendly.retry).toBe(false)
  })

  it('normalizes an unknown code to internal without a validation failure', async () => {
    const error = await providerErrorFromResponse(
      errorResponse(500, 'future_code', 'something new happened'),
    )

    expect(error.code).toBe('internal')
    expect(error.message).toBe('upai:internal: future_code: something new happened')

    const friendly = friendlyError({
      raw: error.storedMessage,
      rules: CUSTOM_ERROR_RULES,
      httpRules: null,
    })

    expect(friendly.title).toBe('ComfyUI did not answer in time.')
    expect(friendly.raw).toContain('future_code')
  })

  it('parses the raw unknown code from the body', () => {
    const parsed = UpaiErrorResponseSchema.parse({
      error: { code: 'future_code', message: 'something new happened', details: {} },
    })

    expect(parsed.error.code).toBe('future_code')
  })
})
