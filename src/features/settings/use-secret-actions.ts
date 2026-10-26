'use client'

import { useCallback, useState } from 'react'

import { messageOf } from '@/core/errors'
import { retrySecrets, testSecretTarget } from '@/lib/api/settings'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

import { SETTINGS_SECTION_IDS, type SettingsSection } from './settings-store'
import { testLine, type TestMessage } from './use-secrets'

const EMPTY_RESULTS = Object.fromEntries(
  SETTINGS_SECTION_IDS.map((section) => {
    return [section, null]
  }),
) as Record<SettingsSection, TestMessage | null>

async function retrySecretsWithToast(): Promise<void> {
  try {
    await retrySecrets()
  } catch (error) {
    toastError(error, 'Retry failed')
  }
}

interface UseSecretActionsParams {
  isDirty: boolean
}

/** Test and retry actions plus their result state for the key sections. */
export function useSecretActions(params: UseSecretActionsParams) {
  const { isDirty } = params
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [testing, setTesting] = useState<SettingsSection | null>(null)

  const resetResults = useCallback(() => {
    setResults(EMPTY_RESULTS)
  }, [])

  const onTest = async (target: SettingsSection) => {
    if (isDirty) {
      setResults((current) => {
        return {
          ...current,
          [target]: { tone: 'info', text: 'Save first to test' },
        }
      })

      return
    }

    setTesting(target)

    try {
      const result = await testSecretTarget(target)

      setResults((current) => {
        return { ...current, [target]: testLine(target, result) }
      })
    } catch (error) {
      setResults((current) => {
        return {
          ...current,
          [target]: { tone: 'error', text: messageOf(error, 'Test failed') },
        }
      })
    } finally {
      setTesting(null)
    }
  }

  const { isRunning: isRetrying, run: onRetry } = useAsyncAction(retrySecretsWithToast)

  return { results, testing, isRetrying, onTest, onRetry, resetResults }
}
