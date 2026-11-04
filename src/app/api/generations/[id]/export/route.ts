import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { copyAtomic, copyExclusive, copyUnique, videoSource } from '@/server/fs/export-files'
import {
  errorResponse,
  type IdRouteContext,
  jsonError,
  jsonResponse,
  zodError,
} from '@/server/http'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { consumeExportFolder, consumeExportPath } from '@/server/services/export-tokens'
import { desktopMode, isDesktopMode } from '@/server/session'

const BodySchema = z.object({
  path: z.string().trim().min(1),
})

/** Copies a finished video to a user-chosen absolute path. */
export async function POST(request: Request, { params }: IdRouteContext): Promise<Response> {
  try {
    if (!desktopMode() || !isDesktopMode()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { id } = await params

    return await exportVideo({ id, target: body.data.path })
  } catch (error) {
    return errorResponse(error)
  }
}

interface ExportVideoParams {
  id: string
  target: string
}

async function exportVideo(params: ExportVideoParams): Promise<Response> {
  const { id, target } = params

  if (!path.isAbsolute(target)) {
    return jsonError({ status: 400, error: 'Path must be absolute' })
  }

  if (path.extname(target).toLowerCase() !== '.mp4') {
    return jsonError({ status: 400, error: 'Only .mp4 files' })
  }

  const record = await getGeneration(id)

  if (!record) {
    return jsonError({ status: 404, error: 'Video not found' })
  }

  const source = await videoSource(record.id)

  if (isNil(source)) {
    return jsonError({ status: 404, error: 'Video not found' })
  }

  const existing = await fs.lstat(target).catch(() => {
    return null
  })

  if (existing && !existing.isFile()) {
    return jsonError({ status: 400, error: 'Target must be a regular file' })
  }

  return await copyVideo({ source, target })
}

interface CopyVideoParams {
  source: string
  target: string
}

async function copyVideo(params: CopyVideoParams): Promise<Response> {
  const { source, target } = params

  if (consumeExportPath(target)) {
    await copyAtomic(source, target)

    return jsonResponse({ path: target }, { status: 201 })
  }

  const dir = path.dirname(target)

  if (!consumeExportFolder(dir)) {
    return jsonError({ status: 403, error: 'Forbidden' })
  }

  if (await copyExclusive(source, target)) {
    return jsonResponse({ path: target }, { status: 201 })
  }

  const saved = await copyUnique({
    source,
    dir,
    base: path.basename(target, path.extname(target)),
    ext: path.extname(target).slice(1),
  })

  return jsonResponse({ path: saved }, { status: 201 })
}
