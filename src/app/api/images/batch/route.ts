import { isNil } from 'lodash-es'

import { type ImageBatchBody, ImageBatchSchema, type ImageOutputRef } from '@/core/api/image'
import type { BatchSkip } from '@/core/api/video'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { deleteImage, deleteOutput, setOutputFavorite } from '@/server/services/image-actions'

type SkipReason = BatchSkip['reason']

const refId = (output: ImageOutputRef): string => {
  return output.outputId ?? output.recordId
}

interface RunActionParams {
  body: ImageBatchBody
  output: ImageOutputRef
}

async function removeRef(output: ImageOutputRef) {
  if (isNil(output.outputId)) {
    return deleteImage(output.recordId)
  }

  return deleteOutput({ recordId: output.recordId, outputId: output.outputId })
}

async function runAction(params: RunActionParams): Promise<SkipReason | null> {
  const { body, output } = params
  const { outputId } = output

  if (body.action === 'favorite') {
    if (isNil(outputId)) {
      return 'not_found'
    }

    const saved = await setOutputFavorite({
      recordId: output.recordId,
      outputId,
      favorite: body.favorite === true,
    })

    if (saved) {
      return null
    }

    return 'not_found'
  }

  const result = await removeRef(output)

  if (result === 'deleted') {
    return null
  }

  if (result === 'not_found') {
    return 'not_found'
  }

  return 'active'
}

/** Sequential per-output batch actions, each record runs under its own lock. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = ImageBatchSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    if (body.data.action === 'favorite' && isNil(body.data.favorite)) {
      return jsonError({ status: 400, error: 'favorite is required for the favorite action' })
    }

    const done: string[] = []
    const skipped: BatchSkip[] = []

    for (const output of body.data.outputs) {
      const reason = await runAction({ body: body.data, output })

      if (isNil(reason)) {
        done.push(refId(output))
      } else {
        skipped.push({ id: refId(output), reason })
      }
    }

    return jsonResponse({ done, skipped })
  } catch (error) {
    return errorResponse(error)
  }
}
