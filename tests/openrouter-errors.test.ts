import { describe, expect, it, vi } from 'vitest'

import { submitError } from '@/server/jobs/run-submit'
import { errorFromResponse } from '@/server/providers/openrouter/http'
import { ProviderError } from '@/server/providers/provider-error'

vi.mock('server-only', () => {
  return {}
})

const response = (body: unknown, status = 400): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('errorFromResponse', () => {
  it('combines the message with provider and raw detail', async () => {
    const error = await errorFromResponse(
      response({
        error: {
          code: 400,
          message: 'Bad request',
          metadata: { provider_name: 'Together', raw: 'image url rejected' },
        },
      }),
    )

    expect(error.message).toBe('Bad request (Together: image url rejected)')
    expect(error.status).toBe(400)
    expect(error.code).toBe('400')
  })

  it('uses the message alone without metadata', async () => {
    const error = await errorFromResponse(
      response({ error: { code: 400, message: 'Bad request' } }),
    )

    expect(error.message).toBe('Bad request')
  })

  it('includes raw when the provider name is missing', async () => {
    const error = await errorFromResponse(
      response({ error: { message: 'Bad request', metadata: { raw: 'nope' } } }),
    )

    expect(error.message).toBe('Bad request (nope)')
  })

  it('truncates raw to 500 characters', async () => {
    const error = await errorFromResponse(
      response({ error: { message: 'Bad request', metadata: { raw: 'x'.repeat(900) } } }),
    )

    expect(error.message).toBe(`Bad request (${'x'.repeat(500)})`)
  })

  it('reads a string code and falls back for a missing message', async () => {
    const error = await errorFromResponse(response({ error: { code: 'provider_error' } }, 502))

    expect(error.code).toBe('provider_error')
    expect(error.message).toBe('HTTP 502')
  })

  it('unwraps a nested JSON provider error and keeps its code', async () => {
    const error = await errorFromResponse(
      response({
        error: {
          code: 400,
          message:
            'HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The image was rejected for sensitive content.","type":"BadRequest"}}',
        },
      }),
    )

    expect(error.message).toBe('The image was rejected for sensitive content.')
    expect(error.code).toBe('InputImageSensitiveContentDetected.PrivacyInformation')
    expect(error.status).toBe(400)
  })

  it('unwraps a stored double-status provider error', async () => {
    const error = await errorFromResponse(
      response({
        error: {
          code: 400,
          message:
            '400: HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image may contain real person.","param":"","type":"BadRequest"}}',
        },
      }),
    )

    expect(error.message).toBe(
      'The request failed because the input image may contain real person.',
    )

    expect(error.code).toBe('InputImageSensitiveContentDetected.PrivacyInformation')
    expect(error.status).toBe(400)
  })

  it('keeps a normal provider message unchanged', async () => {
    const error = await errorFromResponse(
      response({ error: { code: 400, message: 'Bad request' } }),
    )

    expect(error.message).toBe('Bad request')
  })
})

describe('submitError', () => {
  it('does not repeat the HTTP status for a status code', () => {
    expect(
      submitError(
        new ProviderError({
          providerId: 'openrouter',
          kind: 'input',
          message: 'Bad request',
          storedMessage: 'Bad request',
          status: 400,
          code: '400',
        }),
      ),
    ).toBe('Bad request')
  })

  it('prefixes a real provider code once', () => {
    expect(
      submitError(
        new ProviderError({
          providerId: 'openrouter',
          kind: 'content',
          message: 'The image was rejected for sensitive content.',
          storedMessage: 'The image was rejected for sensitive content.',
          status: 400,
          code: 'InputImageSensitiveContentDetected.PrivacyInformation',
        }),
      ),
    ).toBe(
      'InputImageSensitiveContentDetected.PrivacyInformation: The image was rejected for sensitive content.',
    )
  })
})
