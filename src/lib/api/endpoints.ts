'use client'

import { mutate } from 'swr'

import type { EndpointOverview, EndpointTestBody, EndpointTestResult } from '@/core/api/endpoints'
import type {
  CustomEndpointLastHealth,
  CustomEndpointPricing,
} from '@/core/schemas/custom-endpoint'
import { apiPost, apiRequest, fetcher } from '@/lib/fetcher'

import { ENDPOINTS_KEY } from './swr-keys'

export interface EndpointInput {
  id: string | null
  label: string
  badge: string | null
  baseUrl: string
  enabled: boolean
  pricing: CustomEndpointPricing
  instanceId: string | null
  lastHealth: CustomEndpointLastHealth | null
  token?: string | null
}

export interface SaveEndpointsParams {
  endpoints: EndpointInput[]
}

export function fetchEndpoints(): Promise<EndpointOverview> {
  return fetcher<EndpointOverview>(ENDPOINTS_KEY)
}

/** Saves the whole draft: endpoints, tokens and removed ids in one PUT. */
export async function saveEndpoints(params: SaveEndpointsParams): Promise<EndpointOverview> {
  const next = await apiRequest<EndpointOverview>(ENDPOINTS_KEY, {
    method: 'PUT',
    body: JSON.stringify(params),
  })

  await mutate(ENDPOINTS_KEY, next, { revalidate: false })

  return next
}

export function testEndpoint(params: EndpointTestBody): Promise<EndpointTestResult> {
  return apiPost<EndpointTestResult>(`${ENDPOINTS_KEY}/test`, params)
}

/** Revalidates the endpoint overview after a settings save. */
export async function refreshEndpoints(): Promise<void> {
  await mutate(ENDPOINTS_KEY)
}
