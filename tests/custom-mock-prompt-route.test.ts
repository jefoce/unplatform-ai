import { afterAll, afterEach, describe, expect, it } from 'vitest'

const TOKEN = 'route-token'
const PREVIOUS_TOKEN = process.env.APP_TOKEN

process.env.APP_TOKEN = TOKEN

const { GET } = await import('@/app/api/dev/custom-mock/prompt/route')

const { recordCustomMockImagePrompt } = await import('@/server/services/custom-mock-image-prompt')

function promptRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/dev/custom-mock/prompt', {
    headers: { host: '127.0.0.1:3000', cookie: `upai_session=${TOKEN}` },
  })
}

afterEach(() => {
  delete process.env.CUSTOM_ENDPOINT_MOCK
})

describe('custom mock prompt route', () => {
  it('returns 404 unless the custom mock mode is on', async () => {
    const response = await GET(promptRequest())

    expect(response.status).toBe(404)
  })

  it('returns the recorded prompt in custom mock mode', async () => {
    process.env.CUSTOM_ENDPOINT_MOCK = '1'
    recordCustomMockImagePrompt('<image_1>')

    const response = await GET(promptRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ prompt: '<image_1>' })
  })
})

afterAll(() => {
  if (PREVIOUS_TOKEN === undefined) {
    delete process.env.APP_TOKEN

    return
  }

  process.env.APP_TOKEN = PREVIOUS_TOKEN
})
