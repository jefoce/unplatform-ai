import { z } from 'zod'

export const PresetSnapshotSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    family: z.string(),
  })
  .loose()

/** @public */
export type PresetSnapshot = z.infer<typeof PresetSnapshotSchema>
