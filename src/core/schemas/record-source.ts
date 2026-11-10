import { z } from 'zod'

import { PROVIDER_KIND_IDS } from '../providers/types'

export const RecordSourceSchema = z.object({
  kind: z.enum(PROVIDER_KIND_IDS),
  instanceId: z.string(),
  badge: z.string().nullable(),
  presetTitle: z.string(),
  workflowName: z.string().nullable(),
  endpointLabel: z.string().nullable(),
  local: z.boolean(),
})

export type RecordSource = z.infer<typeof RecordSourceSchema>
