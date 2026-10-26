'use client'

import { mutate } from 'swr'

import type { StorageProviderId, VideoProviderId } from '@/core/providers/types'
import type { SecretName } from '@/core/secret-names'
import type { SecretStatus, TestResult } from '@/core/types'
import { apiPost, apiRequest, fetcher } from '@/lib/fetcher'
import { SECRETS_KEY } from '@/lib/swr-keys'

import { refreshRemoteStatus } from './remote'

export type SecretTarget = VideoProviderId | StorageProviderId

export function fetchSecrets(): Promise<SecretStatus> {
  return fetcher<SecretStatus>(SECRETS_KEY)
}

/** Retries a failed keychain load. */
export async function retrySecrets(): Promise<SecretStatus> {
  const next = await apiPost<SecretStatus>(`${SECRETS_KEY}/reload`)

  await mutate(SECRETS_KEY, next, { revalidate: false })
  await refreshRemoteStatus()

  return next
}

/** Saves only the given keys. `null` removes a key. */
export async function saveSecrets(
  values: Partial<Record<SecretName, string | null>>,
): Promise<SecretStatus> {
  const next = await apiRequest<SecretStatus>(SECRETS_KEY, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  })

  await mutate(SECRETS_KEY, next, { revalidate: false })

  return next
}

/** Tests credentials already saved on the server. */
export function testSecretTarget(target: SecretTarget): Promise<TestResult> {
  return apiPost<TestResult>('/api/settings/test', { target })
}
