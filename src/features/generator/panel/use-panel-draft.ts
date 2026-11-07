'use client'

import { useMemo } from 'react'
import { isEmpty } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { getPreset } from '@/core/presets'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { validateInput, validateSettings } from '@/core/validation/video'
import { useSecrets } from '@/features/settings/use-secrets'
import { useModelEntry } from '@/lib/api/catalog'
import { useRemoteStatus } from '@/lib/api/remote'

import { useGeneratorStore } from '../store/store'
import { useProviderReady } from '../use-provider-ready'

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

  const setPrompt = useGeneratorStore((state) => {
    return state.setPrompt
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
  const provider = useProviderReady(presetId, 'video')
  const isKeyMissing = provider.isKeyMissing
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

  const ctx = useMemo(() => {
    return { activeCount, remoteConfigured: isRemoteConfigured, modelStatus, modelReason }
  }, [activeCount, isRemoteConfigured, modelStatus, modelReason])

  const validation = useMemo(() => {
    return validateInput({ input, uploads: uploadsById, preset, ctx })
  }, [input, uploadsById, preset, ctx])

  const settingsValidation = useMemo(() => {
    return validateSettings({ input, uploads: uploadsById, preset, ctx })
  }, [input, uploadsById, preset, ctx])

  return {
    validation,
    settingsValidation,
    isKeyMissing,
    isSecretsFailed,
    provider,
    entry,
    prompt,
    setPrompt,
  }
}
