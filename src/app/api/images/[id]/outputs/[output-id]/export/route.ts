import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { isOneOf } from '@/core/guards'
import { copyAtomic } from '@/server/fs/export-files'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { getImage, imageOutputFile } from '@/server/repos/images'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { consumeExportPath } from '@/server/services/export-tokens'
import { desktopMode, isDesktopMode } from '@/server/session'

const BodySchema = z.object({
  path: z.string().trim().min(1),
})

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const

interface ExportParams {
  id: string
  'output-id': string
}

interface ExportRouteContext {
  params: Promise<ExportParams>
}

/** Copies one saved image output to an absolute path the save dialog returned. */
export async function POST(request: Request, { params }: ExportRouteContext): Promise<Response> {
  try {
    if (!desktopMode() || !isDesktopMode()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { id, 'output-id': outputId } = await params

    return await exportImage({ id, outputId, target: body.data.path })
  } catch (error) {
    return errorResponse(error)
  }
}

interface ExportImageParams {
  id: string
  outputId: string
  target: string
}

async function exportImage(params: ExportImageParams): Promise<Response> {
  const { id, outputId, target } = params

  if (!path.isAbsolute(target)) {
    return jsonError({ status: 400, error: 'Path must be absolute' })
  }

  const targetExt = path.extname(target).slice(1).toLowerCase()

  if (!isOneOf(IMAGE_EXTENSIONS, targetExt)) {
    return jsonError({ status: 400, error: 'Only image files' })
  }

  const record = await getImage(id)

  if (!record) {
    return jsonError({ status: 404, error: 'Image not found' })
  }

  const output = record.outputs.find((item) => {
    return item.id === outputId
  })

  if (!output) {
    return jsonError({ status: 404, error: 'Output not found' })
  }

  const source = imageOutputFile(output)

  if (isNil(source)) {
    return jsonError({ status: 404, error: 'Image is not saved' })
  }

  const sourceExt = path.extname(source).slice(1).toLowerCase()

  if (targetExt !== sourceExt) {
    return jsonError({ status: 400, error: `The file name must end with .${sourceExt}` })
  }

  const existing = await fs.lstat(target).catch(() => {
    return null
  })

  if (existing && !existing.isFile()) {
    return jsonError({ status: 400, error: 'Target must be a regular file' })
  }

  if (!consumeExportPath(target)) {
    return jsonError({ status: 403, error: 'Forbidden' })
  }

  await copyAtomic(source, target)

  return jsonResponse({ path: target }, { status: 201 })
}
