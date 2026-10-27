import { z } from 'zod'

import { MEDIA_KINDS } from '../media-types'
import type { Dict } from '../utility-types'

/** Media kind shared by uploads and record snapshots. */
export const MediaKindSchema = z.enum(MEDIA_KINDS)

export const UploadSourceSchema = z.enum(['file', 'link'])

const LinkModeSchema = z.enum(['symlink', 'hardlink', 'copy'])

export type LinkMode = z.infer<typeof LinkModeSchema>

const UploadRemoteSchema = z.object({
  key: z.string(),
  sha256: z.string(),
  serverSha256: z.string().nullable(),
  size: z.number(),
  mtimeMs: z.number(),
  uploadedAt: z.string(),
  lastUsedAt: z.string(),
})

/** One upload row stored in `uploads/<uuid>.json`. */
export const UploadItemSchema = z.object({
  id: z.string(),
  source: UploadSourceSchema,
  kind: MediaKindSchema,
  mime: z.string(),
  ext: z.string(),
  originalName: z.string(),
  target: z.string().optional(),
  linkMode: LinkModeSchema.optional(),
  sizeBytes: z.number(),
  sha256: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  createdAt: z.string(),
  missing: z.boolean().optional(),
  remote: UploadRemoteSchema.optional(),
})

export type UploadRemote = z.infer<typeof UploadRemoteSchema>

export type UploadItem = z.infer<typeof UploadItemSchema>

/** Uploads keyed by upload id. */
export type UploadsById = Dict<UploadItem>
