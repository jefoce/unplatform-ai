import { isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import { messageOf } from '@/server/errors'
import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { isMockMode } from '@/server/openrouter/client'
import { testR2 } from '@/server/remote/r2'
import { getSecret, secretsReady } from '@/server/secrets'

const BASE_URL = 'https://openrouter.ai'

const BodySchema = z.object({ target: z.enum(['openrouter', 'r2']) })

const KeySchema = z.object({ data: z.object({ label: z.string().optional() }).loose() }).loose()

interface TestResult {
  ok: boolean
  mock?: boolean
  label?: string
  error?: string
}

/** Tests the stored credentials without returning them. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) return zodError(body.error)

    await secretsReady()

    if (body.data.target === 'openrouter') return Response.json(await testOpenRouter())

    if ((process.env.REMOTE_MOCK?.trim() ?? '') !== '' && isMockMode()) {
      return Response.json({ ok: true, mock: true })
    }

    return Response.json(await testR2())
  } catch (error) {
    return errorResponse(error)
  }
}

async function testOpenRouter(): Promise<TestResult> {
  if (isMockMode()) return { ok: true, mock: true }

  const key = getSecret('OPENROUTER_API_KEY')

  if (isNil(key) || key === '')
    return { ok: false, error: 'OpenRouter key is not set. Open Settings.' }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/key`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) return { ok: false, error: `OpenRouter ${res.status} ${res.statusText}` }

    const parsed = KeySchema.safeParse(await res.json().catch(() => null))
    const label = parsed.success ? parsed.data.data.label : undefined

    if (isNil(label) || label === '') return { ok: true }

    return { ok: true, label }
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Test failed') }
  }
}
