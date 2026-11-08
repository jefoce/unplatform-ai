import { z } from 'zod'

import type { EndpointHealthStatus } from '../endpoints'
import { type CustomEndpoint, CustomEndpointLastHealthSchema } from '../schemas/custom-endpoint'

export type EndpointHealthView = EndpointHealthStatus | 'unknown'

interface EndpointRuntime {
  runningJobs: number
  status: EndpointHealthView
  videoCount: number
  imageCount: number
  tokenHint: string | null
  hasToken: boolean
}

export interface EndpointOverviewEntry extends CustomEndpoint, EndpointRuntime {}

export interface EndpointOverview {
  endpoints: EndpointOverviewEntry[]
  nextBadge: string
}

export const EndpointTestBodySchema = z.object({
  baseUrl: z.string(),
  endpointId: z.string().nullable().default(null),
  token: z.string().trim().max(4096).nullable().optional(),
})

export type EndpointTestBody = z.infer<typeof EndpointTestBodySchema>

export const EndpointTestResultSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().nullable(),
    protocol: z.number().nullable(),
    serverVersion: z.string().nullable(),
    videoCount: z.number(),
    imageCount: z.number(),
    authRequired: z.boolean().nullable(),
    lanAllowed: z.boolean().nullable(),
    instanceId: z.string().nullable(),
    maxRunning: z.number().nullable(),
    lastHealth: CustomEndpointLastHealthSchema.nullable(),
  })
  .loose()

export type EndpointTestResult = z.infer<typeof EndpointTestResultSchema>
