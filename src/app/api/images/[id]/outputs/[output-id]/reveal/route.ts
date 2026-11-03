import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import { errorResponse, jsonError } from '@/server/http'
import { getImage, imageOutputFile } from '@/server/repos/images'
import { assertLocalRequest } from '@/server/request-guard'
import { getSystem } from '@/server/system'

interface RevealParams {
  id: string
  'output-id': string
}

interface RevealRouteContext {
  params: Promise<RevealParams>
}

/** Reveals a saved image output in the file manager. */
export async function POST(request: Request, { params }: RevealRouteContext) {
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

    await getSystem().reveal(file)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
