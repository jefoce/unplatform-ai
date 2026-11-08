import 'server-only'

import { isNil, isUndefined } from 'lodash-es'
import { z } from 'zod'

import { HttpError } from '../errors'
import { getSecret, secretsReady, setSecrets } from '../secrets'

const TOKEN_VALUE_MAX_CHARS = 4096

const TokenMapSchema = z.record(z.string(), z.string().max(4096))

export interface EndpointTokenChange {
  id: string
  token: string | null | undefined
}

interface ApplyEndpointTokensParams {
  changes: EndpointTokenChange[]
  removedIds: string[]
}

export interface EndpointTokenPlan {
  current: string | null
  serialized: string
}

interface NextTokenParams {
  current: Record<string, string>
  changes: EndpointTokenChange[]
  removedIds: string[]
}

/** Compact JSON map under one secret. Never logged, last four chars in the UI. */
export function readTokenMap(): Record<string, string> {
  const raw = getSecret('CUSTOM_ENDPOINT_TOKENS')

  if (isNil(raw)) {
    return {}
  }

  try {
    const value: unknown = JSON.parse(raw)
    const parsed = TokenMapSchema.safeParse(value)

    if (!parsed.success) {
      return {}
    }

    return parsed.data
  } catch {
    return {}
  }
}

export function readEndpointToken(endpointId: string): string | null {
  const token = readTokenMap()[endpointId]

  if (isNil(token)) {
    return null
  }

  return token
}

function nextTokenValues(params: NextTokenParams): Record<string, string> {
  const { changes, removedIds } = params
  const next = { ...params.current }

  for (const id of removedIds) {
    delete next[id]
  }

  for (const change of changes) {
    if (isUndefined(change.token)) {
      continue
    }

    const token = change.token?.trim() ?? ''

    if (token === '') {
      delete next[change.id]
      continue
    }

    next[change.id] = token
  }

  return next
}

async function saveTokenValue(serialized: string): Promise<void> {
  const currentValue = getSecret('CUSTOM_ENDPOINT_TOKENS') ?? ''

  if (serialized === '{}') {
    if (currentValue !== '') {
      await setSecrets({ CUSTOM_ENDPOINT_TOKENS: null })
    }

    return
  }

  if (serialized !== currentValue) {
    await setSecrets({ CUSTOM_ENDPOINT_TOKENS: serialized })
  }
}

/** Builds the next map without writing. Fails when the map is too large. */
export async function planEndpointTokens(
  params: ApplyEndpointTokensParams,
): Promise<EndpointTokenPlan> {
  await secretsReady()
  const next = nextTokenValues({ ...params, current: readTokenMap() })
  const serialized = JSON.stringify(next)

  if (serialized.length > TOKEN_VALUE_MAX_CHARS) {
    throw new HttpError(400, 'Too many endpoint tokens')
  }

  return { current: getSecret('CUSTOM_ENDPOINT_TOKENS'), serialized }
}

export async function writeEndpointTokens(serialized: string): Promise<void> {
  await saveTokenValue(serialized)
}

/** Puts back the raw secret read before the attempt. Null or empty clears it. */
export async function restoreEndpointTokens(current: string | null): Promise<void> {
  const isCleared = isNil(current) || current === ''
  const serialized = isCleared ? '{}' : current

  await saveTokenValue(serialized)
}

/** Removes and sets tokens in one write. Fails before saving when the map is too large. */
export async function applyEndpointTokens(params: ApplyEndpointTokensParams): Promise<void> {
  const plan = await planEndpointTokens(params)

  await writeEndpointTokens(plan.serialized)
}
