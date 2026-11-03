import { isNil } from 'lodash-es'
import { z } from 'zod'

import type { ExportEntry } from '@/core/api/export'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import { exportName } from '@/core/media/file-names'
import { copyUnique, videoSource } from '@/server/fs/export-files'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest } from '@/server/request-guard'
import { runExportBatch } from '@/server/services/export-batch'

const BodySchema = z.object({
  ids: z.array(z.uuid()).min(1).max(HISTORY_BATCH_MAX),
  dir: z.string().min(1),
})

type Body = z.infer<typeof BodySchema>

/** Copies each finished video into a real directory, never overwriting. */
export async function POST(request: Request): Promise<Response> {
  return runExportBatch({
    request,
    assertRequest: (request) => {
      assertLocalRequest(request)
    },
    schema: BodySchema,
    items: (body: Body) => {
      return body.ids
    },
    exportEntry,
  })
}

async function exportEntry(id: string, dir: string): Promise<ExportEntry> {
  const record = await getGeneration(id)

  if (!record) {
    return { skip: { id, reason: 'not_found' } }
  }

  if (record.status !== 'completed') {
    return { skip: { id, reason: 'not_ready' } }
  }

  const source = await videoSource(record.id)

  if (isNil(source)) {
    return { skip: { id, reason: 'not_ready' } }
  }

  return { saved: await copyUnique({ source, dir, base: exportName(record), ext: 'mp4' }) }
}
