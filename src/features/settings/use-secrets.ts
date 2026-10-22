'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'
import useSWR, { mutate } from 'swr'
import { z } from 'zod'

import { R2_NAMES, type SecretName } from '@/core/secret-names'
import type { SecretStatus, TestResult } from '@/core/types'
import { apiPost, apiRequest, fetcher } from '@/lib/fetcher'
import { readLocal, writeLocal } from '@/lib/local-store'
import { refreshRemoteStatus } from '@/lib/remote-status'

import { openSettings, type SettingsSection } from './settings-store'

export { R2_NAMES, type SecretName }

export type { SecretKeyStatus, SecretStatus, TestResult } from '@/core/types'

export interface TestMessage {
  tone: 'ok' | 'error' | 'info'
  text: string
}

const SECRETS_KEY = '/api/settings/secrets'
const PROMPTED_KEY = 'unplatform-ai:settings-prompted'
const PROMPTED_VALUE = z.union([z.boolean(), z.string(), z.number()])

/** Status of stored keys, without values. */
export function useSecrets() {
  const {
    data,
    isLoading,
    mutate: refresh,
  } = useSWR<SecretStatus>(SECRETS_KEY, fetcher, {
    revalidateOnFocus: false,
    // Poll while the parent app waits on a keychain prompt.
    refreshInterval: (latest) => (latest?.loading === true ? 2000 : 0),
  })

  return { status: data, isLoading, refresh: () => refresh() }
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
export function testTarget(target: SettingsSection): Promise<TestResult> {
  return apiPost<TestResult>('/api/settings/test', { target })
}

/** OS label for the keychain backend. */
function keychainLabel(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.userAgent

  if (/Mac/.test(platform)) return 'macOS Keychain'

  if (/Win/.test(platform)) return 'Windows Credential Manager'

  return 'system keychain'
}

/** Turns a test response into display text. */
export function testLine(target: SettingsSection, result: TestResult): TestMessage {
  if (!result.ok) return { tone: 'error', text: result.error ?? 'Test failed' }

  if (target === 'r2') {
    return {
      tone: 'ok',
      text: result.mock === true ? 'Upload, read, delete OK (mock)' : 'Upload, read, delete OK',
    }
  }

  if (!isNil(result.label) && result.label !== '') {
    return { tone: 'ok', text: `Key works (label: "${result.label}")` }
  }

  return { tone: 'ok', text: result.mock === true ? 'Key works (mock)' : 'Key works' }
}

/** Footer text for the active backend. */
export function backendNote(backend: SecretStatus['backend'] | undefined): string | null {
  if (backend === 'keychain') return `Stored in ${keychainLabel()}`

  if (backend === 'file') return 'Stored in a file: no system keychain found'

  return null
}

/** Opens Settings once when no key exists and the app is not mocked. */
export function useSettingsPrompt(
  status: SecretStatus | undefined,
  isMock: boolean | undefined,
): void {
  useEffect(() => {
    if (!status || isNil(isMock) || status.loading) return

    if (status.keys.OPENROUTER_API_KEY.set || isMock) return

    const stored = readLocal(PROMPTED_KEY, PROMPTED_VALUE)

    if (!stored.ok) return

    if (!isNil(stored.value) && Boolean(stored.value)) return

    writeLocal(PROMPTED_KEY, true)
    openSettings('openrouter')
  }, [status, isMock])
}
