'use client'

import { mutate } from 'swr'

import type {
  CustomEndpoint,
  CustomEndpointLastHealth,
  CustomEndpointPricing,
} from '@/core/schemas/custom-endpoint'
import { apiPost, apiRequest, fetcher } from '@/lib/fetcher'

export const ENDPOINTS_KEY = '/api/endpoints'

export type EndpointStatus =
  'ok' | 'unreachable' | 'unauthorized' | 'forbidden' | 'protocol' | 'unknown'

interface EndpointRuntime {
  runningJobs: number
  status: EndpointStatus
  videoCount: number
  imageCount: number
  tokenHint: string | null
}

export type EndpointView = CustomEndpoint & EndpointRuntime

export interface EndpointOverview {
  endpoints: EndpointView[]
  nextBadge: string
}

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

export interface EndpointTestParams {
  baseUrl: string
  endpointId: string | null
  token?: string | null
}

export interface EndpointTestResult {
  ok: boolean
  error: string | null
  protocol: number | null
  serverVersion: string | null
  videoCount: number
  imageCount: number
  authRequired: boolean | null
  lanAllowed: boolean | null
  instanceId: string | null
  maxRunning: number | null
  lastHealth: CustomEndpointLastHealth | null
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

export function testEndpoint(params: EndpointTestParams): Promise<EndpointTestResult> {
  return apiPost<EndpointTestResult>(`${ENDPOINTS_KEY}/test`, params)
}
