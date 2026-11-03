import { z } from 'zod'

import { SECRET_NAMES, SECRET_SCHEMAS } from '@/core/secret-names'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { secretsReady, secretStatus, setSecrets } from '@/server/secrets'
import { clearModelCatalog } from '@/server/services/model-catalog'

const SecretValuesSchema = z.object(
  Object.fromEntries(
    SECRET_NAMES.map((name) => {
      return [name, SECRET_SCHEMAS[name].nullable().optional()]
    }),
  ),
)

const BodySchema = z.object({ values: SecretValuesSchema })

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    void secretsReady()

    return jsonResponse(secretStatus())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    await secretsReady()
    await setSecrets(body.data.values)
    clearModelCatalog()

    const names = Object.keys(body.data.values)

    if (names.length > 0) {
      console.log(`[unplatform-ai] secrets updated: ${names.join(', ')}`)
    }

    return jsonResponse(secretStatus())
  } catch (error) {
    return errorResponse(error)
  }
}
