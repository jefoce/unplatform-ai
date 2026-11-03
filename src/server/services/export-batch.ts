import 'server-only'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

import type { ExportEntry } from '@/core/api/export'
import type { BatchSkip } from '@/core/api/video'
import { exportDir } from '@/server/fs/export-files'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { readJsonBody } from '@/server/request-guard'
import { consumeExportFolder } from '@/server/services/export-tokens'
import { desktopMode, isDesktopMode } from '@/server/session'

interface ExportBody {
  dir: string
}

interface ExportBatchParams<Body extends ExportBody, Item> {
  request: Request
  assertRequest: (request: Request) => void
  schema: ZodType<Body>
  items: (body: Body) => Item[]
  exportEntry: (item: Item, dir: string) => Promise<ExportEntry>
}

/** Desktop-only export: gate, folder grant and the shared saved/skipped loop. */
export async function runExportBatch<Body extends ExportBody, Item>(
  params: ExportBatchParams<Body, Item>,
): Promise<Response> {
  const { request, assertRequest, schema, items, exportEntry } = params

  try {
    if (!desktopMode() || !isDesktopMode()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertRequest(request)
    const body = schema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { dir } = body.data
    const folder = await exportDir(dir)

    if (isNil(folder)) {
      return jsonError({ status: 400, error: 'Folder must be a real directory' })
    }

    if (!consumeExportFolder(dir)) {
      return jsonError({ status: 403, error: 'Forbidden' })
    }

    const saved: string[] = []
    const skipped: BatchSkip[] = []

    for (const item of items(body.data)) {
      const entry = await exportEntry(item, folder)

      if ('saved' in entry) {
        saved.push(entry.saved)
      } else {
        skipped.push(entry.skip)
      }
    }

    return jsonResponse({ saved, skipped })
  } catch (error) {
    return errorResponse(error)
  }
}
