'use client'

import { useMemo } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { getPreset } from '@/core/presets'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { validateInput } from '@/core/validation'
import { useSecrets } from '@/features/settings/use-secrets'
import { useModelEntry } from '@/lib/api/models'
import { useRemoteStatus } from '@/lib/api/remote'

import { useGeneratorStore } from '../store/store'

/** Draft input and validation for the active preset. */
export function usePanelDraft() {
  const {
    presetId,
    tab,
    prompt,
    audio: isAudio,
    duration,
    aspectRatio,
    resolution,
    frames,
    references,
    seed,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        tab: state.tab,
        prompt: state.prompts[state.tab],
        audio: state.audio,
        duration: state.duration,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        frames: state.frames,
        references: state.references,
        seed: state.seed,
      }
    }),
  )

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const activeCount = useGeneratorStore((state) => {
    return state.activeCount
  })

  const preset = getPreset(presetId)
  const isRemoteConfigured = useRemoteStatus()
  const entry = useModelEntry(presetId)
  const modelStatus = entry?.status ?? 'unverified'
  const modelReason = entry?.reason ?? null
  const { status: secrets } = useSecrets()
  const isKeyMissing = !isNil(secrets) && !secrets.keys.OPENROUTER_API_KEY.set
  const isSecretsFailed = !isEmpty(secrets?.loadError)

  const input = useMemo<GenerationInput>(() => {
    return {
      presetId,
      tab,
      prompt,
      audio: isAudio,
      duration,
      aspectRatio,
      resolution,
      frames,
      references,
      seed,
    }
  }, [presetId, tab, prompt, isAudio, duration, aspectRatio, resolution, frames, references, seed])

  const validation = useMemo(() => {
    return validateInput({
      input,
      uploads: uploadsById,
      preset,
      ctx: {
        activeCount,
        remoteConfigured: isRemoteConfigured,
        modelStatus,
        modelReason,
      },
    })
  }, [input, uploadsById, preset, activeCount, isRemoteConfigured, modelStatus, modelReason])

  return { validation, isKeyMissing, isSecretsFailed }
}
