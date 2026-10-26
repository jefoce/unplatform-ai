import { z } from 'zod'

export const UPDATE_PHASES = ['downloading', 'installing'] as const

export const INSTALL_KINDS = ['macos', 'windows', 'appimage', 'linux-package', 'browser'] as const

const InstallKindSchema = z.enum(INSTALL_KINDS)

export const AppInfoSchema = z.object({
  version: z.string(),
  installKind: InstallKindSchema,
  autoCheck: z.boolean(),
  lastCheck: z.string().nullable(),
})

export const AppUpdateSchema = z.object({
  version: z.string(),
  notes: z.string(),
  date: z.string().nullable(),
})

export const UpdateCheckSchema = AppUpdateSchema.nullable()

export const UpdateProgressSchema = z.object({
  downloaded: z.number(),
  total: z.number().nullable(),
  phase: z.enum(UPDATE_PHASES),
})

export const InstallResultSchema = z.object({
  cancelled: z.boolean(),
})

export type AppInfo = z.infer<typeof AppInfoSchema>

export type AppUpdate = z.infer<typeof AppUpdateSchema>

export type UpdateProgress = z.infer<typeof UpdateProgressSchema>

export type InstallResult = z.infer<typeof InstallResultSchema>
