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

vi.mock('@/server/repos/generations', () => {
  return {
    listGenerations: async () => {
      return []
    },
  }
})

vi.mock('@/server/session', () => {
  return {
    sessionRequired: () => {
      return false
    },
  }
})

const HealthSchema = z
  .object({
    app: z.literal('unplatform-ai'),
    pid: z.number(),
    version: z.string().nullable(),
    desktop: z.boolean(),
    ready: z.boolean(),
    generating: z.number(),
    downloading: z.number(),
    sending: z.number(),
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

  return HealthSchema.parse(body)
}

afterEach(() => {
  if (originalVersion === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION

    return
  }

  process.env.NEXT_PUBLIC_APP_VERSION = originalVersion
})

describe('health route', () => {
  it('reports the inlined version when set', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '0.3.1'

    const body = await readHealth()

    expect(body.version).toBe('0.3.1')
    expect(body.generating).toBe(0)
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
})
