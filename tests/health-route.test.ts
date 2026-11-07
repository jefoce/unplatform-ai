import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('@/server/jobs/download-queue', () => {
  return {
    downloadQueueIds: () => {
      return []
    },
  }
})

vi.mock('@/server/jobs/poller', () => {
  return {
    isBooted: () => {
      return true
    },
  }
})

vi.mock('@/server/jobs/submit-queue', () => {
  return {
    sendingCount: () => {
      return 0
    },
  }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return {
    imageSendingCount: () => {
      return 1
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    listGenerations: async () => {
      return []
    },
  }
})

const session = vi.hoisted(() => {
  return { has: true }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return session.has
    },
    desktopMode: () => {
      return false
    },
    bootNonce: () => {
      return 'test-nonce'
    },
  }
})

const HealthSchema = z
  .object({
    app: z.literal('unplatform-ai'),
    bootNonce: z.string(),
    pid: z.number(),
    version: z.string().nullable(),
    desktop: z.boolean(),
    ready: z.boolean(),
    generating: z.number(),
    customVideo: z.number(),
    downloading: z.number(),
    sending: z.number(),
    imageSending: z.number(),
    uploading: z.number(),
    grace: z.number(),
    rssMb: z.number(),
  })
  .strict()

const { GET } = await import('@/app/api/health/route')

const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION

function healthRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/health', {
    headers: { host: '127.0.0.1:3000' },
  })
}

async function readHealth(): Promise<z.infer<typeof HealthSchema>> {
  const response = await GET(healthRequest())
  const body: unknown = await response.json()

  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')

  return HealthSchema.parse(body)
}

afterEach(() => {
  session.has = true

  if (originalVersion === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION

    return
  }

  process.env.NEXT_PUBLIC_APP_VERSION = originalVersion
})

describe('health route', () => {
  it('names the image sending field imageSending', async () => {
    const response = await GET(healthRequest())
    const body: unknown = await response.json()

    expect(body).toHaveProperty('imageSending', 1)
    expect(body).not.toHaveProperty('image_sending')
  })

  it('reports the inlined version when set', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '0.3.1'

    const body = await readHealth()

    expect(body.version).toBe('0.3.1')
    expect(body.generating).toBe(0)
    expect(body.imageSending).toBe(1)
    expect(body.grace).toBe(0)
  })

  it('reports null when the version is absent', async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION

    const body = await readHealth()

    expect(body.version).toBeNull()
  })

  it('reports null when the version is empty', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = ''

    const body = await readHealth()

    expect(body.version).toBeNull()
  })

  it('publishes the boot nonce and omits pid and rss without a session', async () => {
    session.has = false
    const response = await GET(healthRequest())
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('bootNonce', 'test-nonce')
    expect(body).not.toHaveProperty('pid')
    expect(body).not.toHaveProperty('rssMb')
  })
})
