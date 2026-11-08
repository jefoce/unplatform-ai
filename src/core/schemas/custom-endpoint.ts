import { z } from 'zod'

export const ENDPOINT_BADGE_PATTERN = /^[A-Z0-9]{1,4}$/

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
    maxRunning: z.number().int().min(1).max(8),
    lanAllowed: z.boolean(),
    authRequired: z.boolean(),
    maxUploadBytes: z.number().int().min(0).default(0),
    checkedAt: z.string(),
  })
  .loose()

export type CustomEndpointLastHealth = z.infer<typeof CustomEndpointLastHealthSchema>

export const CustomEndpointSchema = z
  .object({
    id: z.string(),
    label: z.string().max(40),
    badge: z.string().regex(ENDPOINT_BADGE_PATTERN),
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
    endpoints: z.array(CustomEndpointSchema),
    badgeCounter: z.number().int().min(0).default(0),
  })
  .loose()
  .transform((file) => {
    // loose() keeps unknown keys, so drop the legacy version by hand
    const { version: _version, ...rest } = file

    return rest
  })

export type CustomEndpointFile = z.infer<typeof CustomEndpointFileSchema>
