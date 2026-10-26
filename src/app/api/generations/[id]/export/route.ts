import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { errorResponse, type IdRouteContext, jsonError, zodError } from '@/server/http'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { sessionRequired } from '@/server/session'

import { copyExclusive, videoSource } from '../../export-files'

const BodySchema = z.object({
  path: z.string().trim().min(1),
  overwrite: z.boolean().optional(),
})

/** Copies a finished video to a user-chosen absolute path. */
export async function POST(request: Request, { params }: IdRouteContext): Promise<Response> {
  try {
    if (!sessionRequired()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { id } = await params

    return await exportVideo({
      id,
      target: body.data.path,
      isOverwrite: body.data.overwrite ?? false,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

interface ExportVideoParams {
  id: string
  target: string
  isOverwrite: boolean
}

async function exportVideo(params: ExportVideoParams): Promise<Response> {
  const { id, target, isOverwrite } = params

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

  return await copyVideo({ source, target, isOverwrite })
}

interface CopyVideoParams {
  source: string
  target: string
  isOverwrite: boolean
}

async function copyVideo(params: CopyVideoParams): Promise<Response> {
  const { source, target, isOverwrite } = params

  if (isOverwrite) {
    await fs.copyFile(source, target)

    return Response.json({ path: target }, { status: 201 })
  }

  const didCopy = await copyExclusive(source, target)

  if (!didCopy) {
    return jsonError({ status: 409, error: 'File already exists' })
  }

  return Response.json({ path: target }, { status: 201 })
}
