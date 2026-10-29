import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { isNonEmptyString } from '@/core/guards'

import { getSecret, registerSecretsListener, secretsReady } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import type { AccountLookupParams, ProviderAccount } from '../types'

const BASE_URL = 'https://openrouter.ai'
const CACHE_MS = 30_000

// `/key` sends null for an unlimited key and omits fields it does not track.
const KeyDataSchema = z
  .object({
    limit: z.number().nullish(),
    limit_remaining: z.number().nullish(),
    usage_daily: z.number().nullish(),
    usage_monthly: z.number().nullish(),
  })
  .loose()

const KeySchema = z.object({ data: KeyDataSchema }).loose()

const CreditsDataSchema = z
  .object({
    total_credits: z.number(),
    total_usage: z.number(),
  })
  .loose()

const CreditsSchema = z.object({ data: CreditsDataSchema }).loose()

type KeyData = z.infer<typeof KeyDataSchema>

type CreditsData = z.infer<typeof CreditsDataSchema>

const cache = createTtlCache<ProviderAccount>({
  key: 'credits',
  okTtlMs: CACHE_MS,
  failTtlMs: 0,
})

/** Key and management credits, cached for 30 seconds. Failures are retried, never cached. */
export async function getProviderAccount(opts?: AccountLookupParams): Promise<ProviderAccount> {
  return cache.get('account', loadAccount, opts?.fresh === true)
}

async function loadAccount(
  previous: ProviderAccount | undefined,
): Promise<TtlLoadResult<ProviderAccount>> {
  try {
    return { value: await loadCredits(), isOk: true }
  } catch (error) {
    return {
      value: withError(previous, messageOf(error, 'Credits request failed')),
      isOk: false,
    }
  }
}

async function loadCredits(): Promise<ProviderAccount> {
  await secretsReady()
  const fetchedAt = new Date().toISOString()
  const key = getSecret('OPENROUTER_API_KEY')

  if (!isNonEmptyString(key)) {
    throw new Error('OpenRouter key is not set. Open Settings.')
  }

  const keyInfo = await fetchKey(key)

  const info: ProviderAccount = {
    balance: null,
    keyLimitRemaining: keyInfo.limit_remaining ?? null,
    keyLimit: keyInfo.limit ?? null,
    usageDaily: keyInfo.usage_daily ?? null,
    usageMonthly: keyInfo.usage_monthly ?? null,
    source: 'key',
    fetchedAt,
    error: null,
  }

  const managementKey = getSecret('OPENROUTER_MANAGEMENT_KEY')

  if (!isNonEmptyString(managementKey)) {
    return info
  }

  try {
    const credits = await fetchCredits(managementKey)

    return {
      ...info,
      balance: credits.total_credits - credits.total_usage,
      source: 'management',
    }
  } catch (error) {
    return { ...info, error: messageOf(error, 'Credits request failed') }
  }
}

async function fetchKey(key: string): Promise<KeyData> {
  const parsed = KeySchema.safeParse(await getJson(`${BASE_URL}/api/v1/key`, key))

  if (!parsed.success) {
    throw new Error('Invalid OpenRouter key response')
  }

  return parsed.data.data
}

async function fetchCredits(key: string): Promise<CreditsData> {
  const parsed = CreditsSchema.safeParse(await getJson(`${BASE_URL}/api/v1/credits`, key))

  if (!parsed.success) {
    throw new Error('Invalid OpenRouter credits response')
  }

  return parsed.data.data
}

async function getJson(url: string, key: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} ${res.statusText}`)
  }

  return res.json()
}

function withError(last: ProviderAccount | undefined, message: string): ProviderAccount {
  if (last) {
    return { ...last, error: message }
  }

  const fetchedAt = new Date().toISOString()

  return {
    balance: null,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    source: 'none',
    fetchedAt,
    error: message,
  }
}

/** Clears the account cache when keys change. */
export function registerAccountSecretsListener(): void {
  registerSecretsListener('account', () => {
    cache.clear()
  })
}
