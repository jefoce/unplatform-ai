'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'
import useSWR from 'swr'
import { z } from 'zod'

import { isNonEmptyString } from '@/core/guards'
import { STORAGE_PROVIDER_IDS } from '@/core/providers/types'
import type { SecretBackendKind, SecretStatus, TestResult } from '@/core/types'
import { fetchSecrets } from '@/lib/api/settings'
import { SECRETS_KEY } from '@/lib/api/swr-keys'
import { readLocal, writeLocal } from '@/lib/local-store'

import { openSettings, type SettingsSection } from './settings-store'

export type TestTone = 'ok' | 'error' | 'info'

export interface TestMessage {
  tone: TestTone
  text: string
}

const PROMPTED_KEY = 'unplatform-ai:settings-prompted'
const PROMPTED_VALUE = z.union([z.boolean(), z.string(), z.number()])

/** Status of stored keys, without values. */
export function useSecrets() {
  const {
    data,
    isLoading,
    mutate: refresh,
  } = useSWR<SecretStatus>(SECRETS_KEY, fetchSecrets, {
    revalidateOnFocus: false,
    // Poll while the parent app waits on a keychain prompt.
    refreshInterval: (latest) => {
      const interval = latest?.loading === true ? 2000 : 0

      return interval
    },
  })

  return {
    status: data,
    isLoading,
    refresh: () => {
      return refresh()
    },
  }
}

/** OS label for the keychain backend. */
function keychainLabel(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.userAgent

  if (/Mac/.test(platform)) {
    return 'macOS Keychain'
  }

  if (/Win/.test(platform)) {
    return 'Windows Credential Manager'
  }

  return 'system keychain'
}

/** Turns a test response into display text. */
export function testLine(target: SettingsSection, result: TestResult): TestMessage {
  if (!result.ok) {
    return { tone: 'error', text: result.error ?? 'Test failed' }
  }

  if ((STORAGE_PROVIDER_IDS as readonly string[]).includes(target)) {
    const text = result.mock === true ? 'Upload, read, delete OK (mock)' : 'Upload, read, delete OK'

    return { tone: 'ok', text }
  }

  if (isNonEmptyString(result.label)) {
    return { tone: 'ok', text: `Key works (label: "${result.label}")` }
  }

  const text = result.mock === true ? 'Key works (mock)' : 'Key works'

  return { tone: 'ok', text }
}

/** Footer text for the active backend. */
export function backendNote(backend: SecretBackendKind | undefined): string | null {
  if (backend === 'keychain') {
    return `Stored in ${keychainLabel()}`
  }

  if (backend === 'file') {
    return 'Stored in a file: no system keychain found'
  }

  return null
}

/** Opens Settings once when no key exists and the app is not mocked. */
export function useSettingsPrompt(
  status: SecretStatus | undefined,
  isMock: boolean | undefined,
): void {
  useEffect(() => {
    if (!status || isNil(isMock) || status.loading) {
      return
    }

    if (status.keys.OPENROUTER_API_KEY.set || isMock) {
      return
    }

    const stored = readLocal(PROMPTED_KEY, PROMPTED_VALUE)

    if (!stored.ok) {
      return
    }

    if (!isNil(stored.value) && Boolean(stored.value)) {
      return
    }

    writeLocal(PROMPTED_KEY, true)
    openSettings('openrouter')
  }, [status, isMock])
}
