import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import { errorResponse, jsonError, jsonResponse } from '@/server/http'
import { getImage, imageOutputFile } from '@/server/repos/images'
import { assertLocalRequest } from '@/server/request-guard'
import { createLinkUpload } from '@/server/services/uploads'

interface FrameParams {
  id: string
  'output-id': string
}

interface FrameRouteContext {
  params: Promise<FrameParams>
}

/** Links a saved output into uploads, so the video tab can use it as a frame. */
export async function POST(request: Request, { params }: FrameRouteContext) {
  try {
    assertLocalRequest(request)
    const { id, 'output-id': outputId } = await params
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

    const file = imageOutputFile(output)

    if (isNil(file)) {
      return jsonError({ status: 409, error: 'Image is not saved' })
    }

    const stats = await fs.stat(file).catch(() => {
      return null
    })

    if (stats?.isFile() !== true) {
      return jsonError({ status: 404, error: 'Image file not found' })
    }

    const item = await createLinkUpload({ absPath: file })

    return jsonResponse(item, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
