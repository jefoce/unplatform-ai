import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const TOKEN = 'route-token'
const PREVIOUS_TOKEN = process.env.APP_TOKEN

process.env.APP_TOKEN = TOKEN

const { POST } = await import('@/app/api/dev/model-catalog-delay/route')

const { delayCatalog, setCatalogDelay } = await import('@/server/services/catalog-delay')

function delayRequest(body: unknown): Request {
  return new Request('http://127.0.0.1:3000/api/dev/model-catalog-delay', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      cookie: `upai_session=${TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  delete process.env.CUSTOM_ENDPOINT_MOCK
  setCatalogDelay(0)
})

afterEach(() => {
  delete process.env.CUSTOM_ENDPOINT_MOCK
})

describe('model catalog delay route', () => {
  it('returns 404 unless the custom mock mode is on', async () => {
    const response = await POST(delayRequest({ ms: 2000 }))

    expect(response.status).toBe(404)
  })

  it('rejects a delay outside the allowed range', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    const response = await POST(delayRequest({ ms: 5001 }))

    expect(response.status).toBe(400)
  })

  it('sets the catalog delay', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'

    const response = await POST(delayRequest({ ms: 20 }))
    const started = Date.now()

    await delayCatalog()

    expect(response.status).toBe(204)
    expect(Date.now() - started).toBeGreaterThanOrEqual(10)
  })
})

afterAll(() => {
  if (PREVIOUS_TOKEN === undefined) {
    delete process.env.APP_TOKEN

    return
  }

  process.env.APP_TOKEN = PREVIOUS_TOKEN
})
