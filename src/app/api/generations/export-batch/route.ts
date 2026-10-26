import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import { exportName } from '@/core/file-names'
import type { BatchSkip } from '@/core/types'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { sessionRequired } from '@/server/session'

import { copyExclusive, videoSource } from '../export-files'

const BodySchema = z.object({
  ids: z.array(z.uuid()).min(1).max(HISTORY_BATCH_MAX),
  dir: z.string().min(1),
})

/** Copies each finished video into a real directory, never overwriting. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!sessionRequired()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { ids, dir } = body.data

    if (!path.isAbsolute(dir)) {
      return jsonError({ status: 400, error: 'Folder must be absolute' })
    }

    const folder = await fs.lstat(dir).catch(() => {
      return null
    })

    if (!folder || folder.isSymbolicLink() || !folder.isDirectory()) {
      return jsonError({ status: 400, error: 'Folder must be a real directory' })
    }

    const saved: string[] = []
    const skipped: BatchSkip[] = []

    for (const id of ids) {
      const entry = await exportEntry({ id, dir })

      if ('saved' in entry) {
        saved.push(entry.saved)
      } else {
        skipped.push(entry.skip)
      }
    }

    return Response.json({ saved, skipped })
  } catch (error) {
    return errorResponse(error)
  }
}

interface ExportSaved {
  saved: string
}

interface ExportSkipped {
  skip: BatchSkip
}

type ExportEntry = ExportSaved | ExportSkipped

interface ExportEntryParams {
  id: string
  dir: string
}

async function exportEntry(params: ExportEntryParams): Promise<ExportEntry> {
  const { id, dir } = params
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

  return { saved: await copyUnique({ source, dir, base: exportName(record) }) }
}

interface CopyUniqueParams {
  source: string
  dir: string
  base: string
}

/** First free `name.mp4`, `name (2).mp4`, ... using exclusive copies. */
async function copyUnique(params: CopyUniqueParams): Promise<string> {
  const { source, dir, base } = params

  for (let index = 1; index < 1000; index += 1) {
    const name = index === 1 ? `${base}.mp4` : `${base} (${index}).mp4`
    const target = path.join(dir, name)

    if (await copyExclusive(source, target)) {
      return target
    }
  }

  throw new Error('Too many files with the same name')
}
