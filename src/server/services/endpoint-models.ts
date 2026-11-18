import 'server-only'

import { z } from 'zod'

import { type UpaiModel, UpaiModelSchema } from '@/core/protocol/upai'

const ModelListPayloadSchema = z
  .object({
    data: z.array(z.unknown()),
  })
  .loose()

/**
 * Parses each model on its own.
 * One malformed entry is skipped and the rest of the list loads.
 */
export function parseEndpointModels(payload: unknown, path: string): readonly UpaiModel[] {
  const list = ModelListPayloadSchema.safeParse(payload)

  if (!list.success) {
    throw new Error('Invalid model list response')
  }

  const models = list.data.data.flatMap((entry) => {
    const parsed = UpaiModelSchema.safeParse(entry)

    if (!parsed.success) {
      return []
    }

    return [parsed.data]
  })

  const skipped = list.data.data.length - models.length

  if (skipped > 0) {
    console.warn(`[endpoint-models] skipped ${skipped} malformed models on ${path}`)
  }

  return models
}
