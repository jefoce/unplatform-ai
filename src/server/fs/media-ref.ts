import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'

import { kindFromExt, kindFromName } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import { FoldersFileSchema } from '@/core/schemas/folder-item'
import { UploadItemSchema } from '@/core/schemas/upload-item'

import { HttpError } from '../errors'
import { DOWNLOADS_DIR, FOLDERS_FILE, uploadPaths, UPLOADS_DIR } from '../paths'
import { readJson } from './json-file'
import { resolveInside, SafePathError } from './safe-path'

class MediaRefError extends HttpError {}

export interface ResolvedMediaRef {
  absolutePath: string
  kind: MediaKind
  ref: string
}

function mediaRefToString(segments: string[]): string {
  return segments.join('/')
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function resolveMediaRef(segments: string[]): Promise<ResolvedMediaRef> {
  const ref = mediaRefToString(segments)
  const [namespace, ...rest] = segments

  if (namespace === 'downloads') {
    return resolveDownload(rest, ref)
  }

  if (namespace === 'uploads') {
    return resolveUpload(rest, ref)
  }

  if (namespace === 'folders') {
    return resolveFolder(rest, ref)
  }

  throw new MediaRefError(400, `Unknown media ref: ${ref}`)
}

function resolveDownload(rest: string[], ref: string): ResolvedMediaRef {
  const [name] = rest

  if (rest.length !== 1 || isNil(name)) {
    throw new MediaRefError(400, `Invalid downloads ref: ${ref}`)
  }

  const kind = kindFromName(name)

  if (isNil(kind)) {
    throw new MediaRefError(400, `Unsupported media type: ${name}`)
  }

  return { absolutePath: inside(DOWNLOADS_DIR, name), kind, ref }
}

async function resolveUpload(rest: string[], ref: string): Promise<ResolvedMediaRef> {
  const [id] = rest

  if (rest.length !== 1 || isNil(id) || !isUuid(id)) {
    throw new MediaRefError(400, `Invalid uploads ref: ${ref}`)
  }

  const item = await readJson(path.join(UPLOADS_DIR, `${id}.json`), UploadItemSchema)

  if (!item) {
    throw new MediaRefError(404, `Upload not found: ${id}`)
  }

  const kind = kindFromExt(item.ext)

  if (isNil(kind)) {
    throw new MediaRefError(400, `Unsupported media type: ${item.ext}`)
  }

  const { media } = uploadPaths(id, item.ext)

  try {
    await fs.stat(media)
  } catch {
    throw new MediaRefError(404, `Upload file missing: ${id}`)
  }

  return { absolutePath: media, kind, ref }
}

async function resolveFolder(rest: string[], ref: string): Promise<ResolvedMediaRef> {
  if (rest.length < 2) {
    throw new MediaRefError(400, `Invalid folders ref: ${ref}`)
  }

  const [folderId, ...rel] = rest
  const folders = await readJson(FOLDERS_FILE, FoldersFileSchema)

  const folder = folders?.find((item) => {
    return item.id === folderId
  })

  if (!folder) {
    throw new MediaRefError(404, `Folder not found: ${folderId}`)
  }

  const kind = kindFromName(rel.at(-1) ?? '')

  if (isNil(kind)) {
    throw new MediaRefError(400, `Unsupported media type: ${ref}`)
  }

  return { absolutePath: inside(folder.path, rel.join('/')), kind, ref }
}

function inside(root: string, rel: string): string {
  try {
    return resolveInside(root, rel)
  } catch (error) {
    if (error instanceof SafePathError) {
      throw new MediaRefError(400, error.message)
    }

    throw error
  }
}
