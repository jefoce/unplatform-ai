'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { inputForSubmit } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'
import { friendlyError } from '@/core/provider-errors'
import { providerDescriptor } from '@/core/providers/registry'
import type { ProviderKindId } from '@/core/providers/types'
import { openSettings } from '@/features/settings/settings-store'
import { requestNotifications } from '@/features/shared/request-notifications'
import { refreshCredits } from '@/lib/api/credits'
import { createGeneration } from '@/lib/api/generations'
import { refreshHistoryFeeds } from '@/lib/history-feed-refresh'
import { useAsyncAction } from '@/lib/use-async-action'

import { useGeneratorStore } from '../store/store'
import { inputFromState } from '../store/store-draft'
import { cancelGeneration } from './cancel-generation'

interface ShowErrorParams {
  message: string
  presetId: string
  presetTitle: string
  provider: ProviderKindId
}

/** Shows the plain error with the preset name, plus Settings when the key is missing. */
function showError(params: ShowErrorParams): void {
  const { message, presetId, presetTitle, provider } = params

  const friendly = friendlyError({
    raw: message,
    rules: getPreset(presetId).errors,
    httpRules: providerDescriptor(provider).httpRules,
  })

  const title = `${presetTitle}: ${friendly.title}`

  if (!message.includes('key is not set')) {
    toast.error(title)

    return
  }

  toast.error(title, {
    action: {
      label: 'Open Settings',
      onClick: () => {
        openSettings('openrouter')
      },
    },
  })
}

interface GenerateOptions {
  canSubmit?: boolean
}

/** Submits the draft, refreshes generation lists and credits. Returns the record id. */
export function useGenerate(options: GenerateOptions = {}) {
  const { canSubmit = true } = options
  const [error, setError] = useState<string | null>(null)
  const resultId = useRef<string | null>(null)

  const generation = useAsyncAction(async () => {
    if (!canSubmit) {
      return
    }

    resultId.current = null
    requestNotifications()
    setError(null)

    try {
      const input = inputForSubmit(inputFromState(useGeneratorStore.getState()))
      const record = await createGeneration(input)

      resultId.current = record.id

      if (record.status === 'failed') {
        showError({
          message: record.error ?? 'Submit failed',
          presetId: record.input.presetId,
          presetTitle: record.preset.title,
          provider: record.provider,
        })
      } else {
        toast.success('Generation starts in 10s', {
          action: {
            label: 'Undo',
            onClick: () => {
              return void cancelGeneration(record.id)
            },
          },
        })
      }

      await Promise.all([refreshHistoryFeeds(), refreshCredits(true)])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Request failed'
      const preset = getPreset(useGeneratorStore.getState().presetId)

      resultId.current = null
      setError(message)

      showError({
        message,
        presetId: preset.id,
        presetTitle: preset.title,
        provider: 'openrouter',
      })
    }
  })

  const generate = useCallback(async (): Promise<string | null> => {
    await generation.run()

    return resultId.current
  }, [generation])

  return { generate, isGenerating: generation.isRunning, error }
}
