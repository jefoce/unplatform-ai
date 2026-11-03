import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import type { ExportEntry } from '@/core/api/export'
import { ImageOutputRefSchema } from '@/core/api/image'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import { promptSlug } from '@/core/media/file-names'
import { copyUnique } from '@/server/fs/export-files'
import { getImage, imageOutputFile } from '@/server/repos/images'
import { assertLocalRequest } from '@/server/request-guard'
import { runExportBatch } from '@/server/services/export-batch'

const ExportRefSchema = ImageOutputRefSchema.extend({ outputId: z.uuid() })

type ExportRef = z.infer<typeof ExportRefSchema>

const BodySchema = z.object({
  outputs: z.array(ExportRefSchema).min(1).max(HISTORY_BATCH_MAX),
  dir: z.string().min(1),
})

type Body = z.infer<typeof BodySchema>

/** Copies each saved image output into a real directory, never overwriting. */
export async function POST(request: Request): Promise<Response> {
  return runExportBatch({
    request,
    assertRequest: (request) => {
      assertLocalRequest(request)
    },
    schema: BodySchema,
    items: (body: Body) => {
      return body.outputs
    },
    exportEntry,
  })
}

async function exportEntry(output: ExportRef, dir: string): Promise<ExportEntry> {
  const record = await getImage(output.recordId)

  if (!record) {
    return { skip: { id: output.outputId, reason: 'not_found' } }
  }

  const saved = record.outputs.find((item) => {
    return item.id === output.outputId
  })

  if (isNil(saved)) {
    return { skip: { id: output.outputId, reason: 'not_found' } }
  }

  const source = imageOutputFile(saved)

  if (isNil(source)) {
    return { skip: { id: output.outputId, reason: 'not_ready' } }
  }

  const stats = await fs.stat(source).catch(() => {
    return null
  })

  if (stats?.isFile() !== true) {
    return { skip: { id: output.outputId, reason: 'not_ready' } }
  }

  const base = `${promptSlug(record)}-${saved.id.slice(0, 6)}`
  const ext = path.extname(source).slice(1)
  const target = await copyUnique({ source, dir, base, ext })

  return { saved: target }
}
