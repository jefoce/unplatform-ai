import { isNil } from 'lodash-es'
import { z } from 'zod'

import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { addFolder } from '@/server/repos/folders'
import { getSystem } from '@/server/system'

const BodySchema = z.object({})

const PROMPT = 'Choose a folder'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) return zodError(body.error)

    const path = await getSystem().chooseFolder({ prompt: PROMPT })

    if (isNil(path) || path === '') return Response.json(null, { status: 201 })

    return Response.json(await addFolder({ path }), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
