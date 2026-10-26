import { isNil } from 'lodash-es'
import { z } from 'zod'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import type { BatchSkip } from '@/core/types'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { deleteGeneration, setFavorite } from '@/server/jobs/generation-actions'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

const BodySchema = z.object({
  action: z.enum(['favorite', 'delete']),
  ids: z.array(z.uuid()).min(1).max(HISTORY_BATCH_MAX),
  favorite: z.boolean().optional(),
})

type SkipReason = BatchSkip['reason']

/** Sequential per-record batch actions, each record runs under its own lock. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const { action, ids, favorite: isFavorite } = body.data

    if (action === 'favorite' && isNil(isFavorite)) {
      return jsonError({ status: 400, error: 'favorite is required for the favorite action' })
    }

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

    return Response.json({ done, skipped })
  } catch (error) {
    return errorResponse(error)
  }
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
