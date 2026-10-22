import 'server-only'

import { sumBy } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { CreditsInfo } from '@/core/types'

import { messageOf } from '../errors'
import { globalState } from '../global-state'
import { listGenerations } from '../repos/generations'
import { getSecret, isNonEmptyString, onSecretsChange, secretsReady } from '../secrets'
import { isMockMode } from './client'

const BASE_URL = 'https://openrouter.ai'
const CACHE_MS = 30_000

const KeySchema = z
  .object({
    data: z
      .object({
        limit: z.number().nullable().optional(),
        limit_remaining: z.number().nullable().optional(),
        usage_daily: z.number().nullable().optional(),
        usage_monthly: z.number().nullable().optional(),
      })
      .loose(),
  })
  .loose()

const CreditsSchema = z
  .object({
    data: z
      .object({
        total_credits: z.number(),
        total_usage: z.number(),
      })
      .loose(),
  })
  .loose()

interface CacheEntry {
  info: CreditsInfo
  at: number
}

const cache = globalState('credits', () => ({ entry: undefined as CacheEntry | undefined }))

/** Key and management credits, cached for 30 seconds. Never throws. */
export async function getCredits(opts?: { fresh?: boolean }): Promise<CreditsInfo> {
  const cached = cache.entry

  if (opts?.fresh !== true && cached && Date.now() - cached.at < CACHE_MS) return cached.info

  try {
    const info = await loadCredits()

    cache.entry = { info, at: Date.now() }

    return info
  } catch (error) {
    return withError(cached?.info ?? null, messageOf(error, 'Credits request failed'))
  }
}

async function loadCredits(): Promise<CreditsInfo> {
  await secretsReady()
  const localSpent = await spentLocally()
  const fetchedAt = new Date().toISOString()

  if (isMockMode()) {
    return {
      balance: 10,
      keyLimitRemaining: null,
      keyLimit: null,
      usageDaily: null,
      usageMonthly: null,
      localSpent,
      source: 'mock',
      fetchedAt,
    }
  }

  const key = getSecret('OPENROUTER_API_KEY')

  if (!isNonEmptyString(key)) throw new Error('OpenRouter key is not set. Open Settings.')

  const keyInfo = await fetchKey(key)
  const info: CreditsInfo = {
    balance: null,
    keyLimitRemaining: keyInfo.limit_remaining ?? null,
    keyLimit: keyInfo.limit ?? null,
    usageDaily: keyInfo.usage_daily ?? null,
    usageMonthly: keyInfo.usage_monthly ?? null,
    localSpent,
    source: 'key',
    fetchedAt,
  }

  const managementKey = getSecret('OPENROUTER_MANAGEMENT_KEY')

  if (!isNonEmptyString(managementKey)) return info

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

async function fetchKey(key: string): Promise<z.infer<typeof KeySchema>['data']> {
  const parsed = KeySchema.safeParse(await getJson(`${BASE_URL}/api/v1/key`, key))

  if (!parsed.success) throw new Error('Invalid OpenRouter key response')

  return parsed.data.data
}

async function fetchCredits(key: string): Promise<z.infer<typeof CreditsSchema>['data']> {
  const parsed = CreditsSchema.safeParse(await getJson(`${BASE_URL}/api/v1/credits`, key))

  if (!parsed.success) throw new Error('Invalid OpenRouter credits response')

  return parsed.data.data
}

async function getJson(url: string, key: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })

  if (!res.ok) throw new Error(`OpenRouter ${res.status} ${res.statusText}`)

  return res.json()
}

function spentLocally(): Promise<number> {
  return listGenerations().then((records) => sumBy(records, (record) => record.cost.actualUsd ?? 0))
}

function withError(last: CreditsInfo | null, message: string): CreditsInfo {
  if (last) return { ...last, error: message }

  const fetchedAt = new Date().toISOString()

  return {
    balance: null,
    keyLimitRemaining: null,
    keyLimit: null,
    usageDaily: null,
    usageMonthly: null,
    localSpent: 0,
    source: 'none',
    fetchedAt,
    error: message,
  }
}

onSecretsChange(() => {
  cache.entry = undefined
})
