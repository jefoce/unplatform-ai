'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { errorMessage } from '@/lib/errors'

import type { SettingsSection } from './settings-store'
import { retrySecrets, testLine, type TestMessage, testTarget } from './use-secrets'

const EMPTY_RESULTS: Record<SettingsSection, TestMessage | null> = { openrouter: null, r2: null }

interface UseSecretActionsParams {
  isDirty: boolean
}

/** Test and retry actions plus their result state for the key sections. */
export function useSecretActions(params: UseSecretActionsParams) {
  const { isDirty } = params
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [testing, setTesting] = useState<SettingsSection | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const resetResults = useCallback(() => setResults(EMPTY_RESULTS), [])

  const onTest = async (target: SettingsSection) => {
    if (isDirty) {
      setResults((current) => ({
        ...current,
        [target]: { tone: 'info', text: 'Save first to test' },
      }))

      return
    }

    setTesting(target)

    try {
      const result = await testTarget(target)

      setResults((current) => ({ ...current, [target]: testLine(target, result) }))
    } catch (error) {
      setResults((current) => ({
        ...current,
        [target]: { tone: 'error', text: errorMessage(error, 'Test failed') },
      }))
    } finally {
      setTesting(null)
    }
  }

  const onRetry = async () => {
    setIsRetrying(true)

    try {
      await retrySecrets()
    } catch (error) {
      toast.error(errorMessage(error, 'Retry failed'))
    } finally {
      setIsRetrying(false)
    }
  }

  return { results, testing, isRetrying, onTest, onRetry, resetResults }
}
