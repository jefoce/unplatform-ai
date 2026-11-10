import { describe, expect, it } from 'vitest'

import { EndpointInputSchema, SaveEndpointsBodySchema } from '@/core/api/endpoints'

describe('endpoint request shape', () => {
  it('fills the defaults for one minimal endpoint', () => {
    const body = SaveEndpointsBodySchema.parse({
      endpoints: [{ label: 'Studio', baseUrl: 'http://127.0.0.1:8188' }],
    })

    expect(body.endpoints[0]).toEqual({
      id: null,
      label: 'Studio',
      badge: null,
      baseUrl: 'http://127.0.0.1:8188',
      enabled: true,
      pricing: { mode: 'model', usd: 0 },
      instanceId: null,
      lastHealth: null,
    })
  })

  it('rejects a token with a space and more than 50 endpoints', () => {
    const token = EndpointInputSchema.safeParse({
      label: 'Studio',
      baseUrl: 'http://127.0.0.1:8188',
      token: 'a b',
    })

    expect(token.success).toBe(false)

    const endpoints = Array.from({ length: 51 }, () => {
      return { label: 'Studio', baseUrl: 'http://127.0.0.1:8188' }
    })

    expect(SaveEndpointsBodySchema.safeParse({ endpoints }).success).toBe(false)
  })
})
