import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isString } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { UploadItem } from '@/core/schemas/upload-item'

import { UploadError } from '../errors'
import { resolveInside, resolveRealInside, SafePathError } from '../fs/safe-path'
import { getFolder } from '../repos/folders'
import { listUploadRecords } from '../repos/upload-record'

interface ResolveUploadTargetParams {
  absPath: string
  folderId?: string
  relPath?: string
}

export interface UploadTarget {
  path: string
  real: string
}

/** Resolves the requested path and its real target, keeping folder links inside the folder. */
export async function resolveUploadTarget(
  params: ResolveUploadTargetParams,
): Promise<UploadTarget> {
  const { absPath, folderId, relPath } = params

  if (isNonEmptyString(folderId) && isString(relPath)) {
    const folder = await getFolder(folderId)

    if (!folder) {
      throw new UploadError(404, `Folder not found: ${folderId}`)
    }

    return realInside({ root: folder.path, path: inside(folder.path, relPath) })
  }

  if (!path.isAbsolute(absPath)) {
    throw new UploadError(400, 'Path must be absolute')
  }

  return {
    path: absPath,
    real: await fs.realpath(absPath).catch(() => {
      return absPath
    }),
  }
}

/** Existing upload linked to this real target, matched from one record pass. */
export async function findLinkedUpload(target: string): Promise<UploadItem | null> {
  const byTarget = new Map<string, UploadItem>()

  for (const record of await listUploadRecords()) {
    if (record.source !== 'link' || !isNonEmptyString(record.target)) {
      continue
    }

    byTarget.set(record.target, record)
  }

  return byTarget.get(target) ?? null
}

function inside(root: string, rel: string): string {
  try {
    return resolveInside(root, rel)
  } catch (error) {
    if (error instanceof SafePathError) {
      throw new UploadError(400, error.message)
    }

    throw error
  }
}

interface RealInsideParams {
  root: string
  path: string
}

async function realInside(params: RealInsideParams): Promise<UploadTarget> {
  const { root, path: requested } = params

  try {
    return { path: requested, real: await resolveRealInside(root, requested) }
  } catch (error) {
    if (error instanceof SafePathError) {
      throw new UploadError(404, 'File not found')
    }

    throw error
  }
}
