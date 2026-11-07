import { z } from 'zod'

export const CUSTOM_ENDPOINT_PRICING_MODES = ['model', 'free', 'perRun', 'perSecond'] as const

export type CustomEndpointPricingMode = (typeof CUSTOM_ENDPOINT_PRICING_MODES)[number]

export const CustomEndpointPricingSchema = z
  .object({
    mode: z.enum(CUSTOM_ENDPOINT_PRICING_MODES).default('model'),
    usd: z.number().min(0).default(0),
  })
  .loose()

export type CustomEndpointPricing = z.infer<typeof CustomEndpointPricingSchema>

export const CustomEndpointLastHealthSchema = z
  .object({
    protocol: z.number().int(),
    serverVersion: z.string(),
    maxRunning: z.number().int(),
    lanAllowed: z.boolean(),
    authRequired: z.boolean(),
    checkedAt: z.string(),
  })
  .loose()

export type CustomEndpointLastHealth = z.infer<typeof CustomEndpointLastHealthSchema>

export const CustomEndpointSchema = z
  .object({
    id: z.string(),
    label: z.string().max(40),
    badge: z.string().regex(/^[A-Z0-9]{1,4}$/),
    baseUrl: z.string(),
    enabled: z.boolean().default(true),
    pricing: CustomEndpointPricingSchema.default({ mode: 'model', usd: 0 }),
    instanceId: z.string().nullable().default(null),
    lastHealth: CustomEndpointLastHealthSchema.nullable().default(null),
  })
  .loose()

export type CustomEndpoint = z.infer<typeof CustomEndpointSchema>

export const CustomEndpointFileSchema = z
  .object({
    version: z.literal(1).default(1),
    endpoints: z.array(CustomEndpointSchema),
    badgeCounter: z.number().int().min(0).default(0),
  })
  .loose()

export type CustomEndpointFile = z.infer<typeof CustomEndpointFileSchema>
