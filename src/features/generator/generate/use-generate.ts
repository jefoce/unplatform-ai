'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { inputForSubmit } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'
import { friendlyError } from '@/core/provider-errors'
import { videoProviderDescriptor } from '@/core/providers/registry'
import { VIDEO_PROVIDER_IDS, type VideoProviderId } from '@/core/providers/types'
import { openSettings } from '@/features/settings/settings-store'
import { refreshCredits } from '@/lib/api/credits'
import { cancelGenerationRequest, createGeneration } from '@/lib/api/generations'
import { ApiError } from '@/lib/fetcher'
import { toastError } from '@/lib/notify'
import { getPlatform } from '@/lib/platform'
import { refreshHistory } from '@/lib/swr-keys'
import { useAsyncAction } from '@/lib/use-async-action'

import { useGeneratorStore } from '../store/store'
import { inputFromState } from '../store/store-draft'

function requestNotifications(): void {
  void getPlatform()
    .then((platform) => {
      return platform.requestNotifications()
    })
    .catch(() => {})
}

/** Cancels a generation still inside the submit grace window. */
async function cancelGeneration(id: string): Promise<void> {
  try {
    await cancelGenerationRequest(id)
    toast.success('Generation cancelled')
    await refreshHistory()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error('Already sent, cannot cancel')
      await refreshHistory()

      return
    }

    toastError(error)
  }
}

interface ShowErrorParams {
  message: string
  presetId: string
  presetTitle: string
  provider: VideoProviderId
}

/** Shows the plain error with the preset name, plus Settings when the key is missing. */
function showError(params: ShowErrorParams): void {
  const { message, presetId, presetTitle, provider } = params

  const friendly = friendlyError({
    raw: message,
    family: getPreset(presetId).family,
    httpRules: videoProviderDescriptor(provider).httpRules,
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

/** Submits the draft, refreshes generation lists and credits. Returns the record id. */
export function useGenerate() {
  const [error, setError] = useState<string | null>(null)
  const resultId = useRef<string | null>(null)

  const generation = useAsyncAction(async () => {
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

      await Promise.all([refreshHistory(), refreshCredits()])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Request failed'
      const preset = getPreset(useGeneratorStore.getState().presetId)

      resultId.current = null
      setError(message)

      showError({
        message,
        presetId: preset.id,
        presetTitle: preset.title,
        provider: VIDEO_PROVIDER_IDS[0],
      })
    }
  })

  const generate = useCallback(async (): Promise<string | null> => {
    await generation.run()

    return resultId.current
  }, [generation])

  return { generate, isGenerating: generation.isRunning, error }
}
