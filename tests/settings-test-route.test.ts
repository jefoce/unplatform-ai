import { beforeEach, describe, expect, it, vi } from 'vitest'

const connection = vi.hoisted(() => {
  return {
    testConnection: vi.fn(async () => {
      return { ok: true }
    }),
  }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

vi.mock('@/server/services/connection-test', () => {
  return { testConnection: connection.testConnection }
})

const { POST } = await import('@/app/api/settings/test/route')

function request(body: unknown): Request {
  return new Request('http://localhost/api/settings/test', {
    method: 'POST',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  connection.testConnection.mockClear()
})

describe('settings test route', () => {
  it('rejects the custom provider kind with a clear 400', async () => {
    const response = await POST(request({ target: 'custom' }))

    expect(response.status).toBe(400)
    expect(connection.testConnection).not.toHaveBeenCalled()
  })

  it('tests the OpenRouter credentials', async () => {
    const response = await POST(request({ target: 'openrouter' }))

    expect(response.status).toBe(200)
    expect(connection.testConnection).toHaveBeenCalledWith('openrouter')
  })
})
