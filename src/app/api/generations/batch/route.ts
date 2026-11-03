import { isNil } from 'lodash-es'

import { type BatchSkip, type GenerationBatch, GenerationBatchSchema } from '@/core/api/video'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { deleteGeneration, setFavorite } from '@/server/jobs/generation-actions'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

type SkipReason = BatchSkip['reason']

/** Sequential per-record batch actions, each record runs under its own lock. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = GenerationBatchSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return await runBatch(body.data)
  } catch (error) {
    return errorResponse(error)
  }
}

async function runBatch(batch: GenerationBatch): Promise<Response> {
  const { action, ids, favorite: isFavorite } = batch

  const done: string[] = []
  const skipped: BatchSkip[] = []

  for (const id of ids) {
    const reason = await runAction({ action, id, isFavorite: isFavorite === true })

    if (isNil(reason)) {
      done.push(id)
    } else {
      skipped.push({ id, reason })
    }
  }

  return jsonResponse({ done, skipped })
}

interface RunActionParams {
  action: 'favorite' | 'delete'
  id: string
  isFavorite: boolean
}

async function runAction(params: RunActionParams): Promise<SkipReason | null> {
  const { action, id, isFavorite } = params

  if (action === 'favorite') {
    return favoriteOne(id, isFavorite)
  }

  return deleteOne(id)
}

async function favoriteOne(id: string, isFavorite: boolean): Promise<SkipReason | null> {
  const saved = await setFavorite(id, isFavorite)

  if (saved) {
    return null
  }

  return 'not_found'
}

async function deleteOne(id: string): Promise<SkipReason | null> {
  const result = await deleteGeneration(id)

  if (result === 'deleted') {
    return null
  }

  if (result === 'not_found') {
    return 'not_found'
  }

  return 'active'
}
