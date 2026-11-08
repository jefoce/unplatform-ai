import { z } from 'zod'

import type { EndpointHealthStatus } from '../endpoints'
import {
  type CustomEndpoint,
  CustomEndpointLastHealthSchema,
  CustomEndpointPricingSchema,
} from '../schemas/custom-endpoint'

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
    serverVersion: z.string().nullable(),
    videoCount: z.number(),
    imageCount: z.number(),
    authRequired: z.boolean().nullable(),
    lanAllowed: z.boolean().nullable(),
    instanceId: z.string().nullable(),
    lastHealth: CustomEndpointLastHealthSchema.nullable(),
  })
  .loose()

export type EndpointTestResult = z.infer<typeof EndpointTestResultSchema>

export const EndpointInputSchema = z.object({
  id: z.string().nullable().default(null),
  label: z.string().max(40),
  badge: z.string().nullable().default(null),
  baseUrl: z.string(),
  enabled: z.boolean().default(true),
  pricing: CustomEndpointPricingSchema.default({ mode: 'model', usd: 0 }),
  instanceId: z.string().nullable().default(null),
  lastHealth: CustomEndpointLastHealthSchema.nullable().default(null),
  token: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .regex(/^[^\s]+$/, 'No spaces or line breaks')
    .nullable()
    .optional(),
})

export type EndpointInput = z.infer<typeof EndpointInputSchema>

export interface SaveEndpointsParams {
  endpoints: EndpointInput[]
}

export const SaveEndpointsBodySchema = z.object({ endpoints: z.array(EndpointInputSchema).max(50) })
