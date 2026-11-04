import fs from 'node:fs/promises'

import { MAX_IDS, MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from '@/core/constants'
import type { UploadItem } from '@/core/schemas/upload-item'
import { streamMultipartFiles } from '@/server/fs/multipart'
import { errorResponse, jsonError, jsonResponse, parseKinds } from '@/server/http'
import { STORAGE_TMP_DIR } from '@/server/paths'
import { listUploads } from '@/server/repos/uploads'
import { assertLocalRequest } from '@/server/request-guard'
import { createStagedUpload } from '@/server/services/upload-staged'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const query = new URL(request.url).searchParams

    const ids = (query.get('ids') ?? '')
      .split(',')
      .map((part) => {
        return part.trim()
      })
      .filter(Boolean)

    if (ids.length > MAX_IDS) {
      return jsonError({ status: 400, error: `Too many ids (max ${MAX_IDS})` })
    }

    const items = await listUploads({ kinds: parseKinds(query.get('kind')), ids })

    return jsonResponse(items)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)

    const files = await streamMultipartFiles({
      request,
      dir: STORAGE_TMP_DIR,
      maxBytes: MAX_UPLOAD_BYTES,
      maxFiles: MAX_UPLOAD_FILES,
    })

    if (files.length === 0) {
      return jsonError({ status: 400, error: 'No files provided' })
    }

    try {
      const items: UploadItem[] = []

      for (const file of files) {
        const originalName = file.name === '' ? `pasted-${Date.now()}.png` : file.name

        items.push(await createStagedUpload({ temp: file.path, originalName }))
      }

      return jsonResponse(items, { status: 201 })
    } finally {
      await Promise.all(
        files.map((file) => {
          return fs.unlink(file.path).catch(() => {})
        }),
      )
    }
  } catch (error) {
    return errorResponse(error)
  }
}
