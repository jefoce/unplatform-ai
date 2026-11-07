'use client'

import { useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { IMAGE_MAX_ACTIVE } from '@/core/constants'
import { issueText, type ValidationIssue } from '@/core/validation/common'
import { imageWarnings, validateImagePrompt, validateImageSettings } from '@/core/validation/image'
import { GenerateButton } from '@/features/generator/generate/GenerateButton'
import { isPriceReason, useSubmitGate } from '@/features/generator/generate/use-submit-gate'
import { isPriceVisibleFor } from '@/features/generator/model/price-visibility'
import { useProviderReady } from '@/features/generator/use-provider-ready'
import { registerPickerAnchor } from '@/features/media-picker/picker/anchors'
import { useModelEntry } from '@/lib/api/models'

import { ImagePromptControls } from './ImagePromptControls'
import { ImageReferences } from './ImageReferences'
import { currentImagePreset } from './preset'
import { useImageGeneratorStore } from './store'
import { useImageEstimate } from './use-image-estimate'
import { useImageSubmit } from './use-image-submit'
import { useImageUploadsRefresh } from './use-image-uploads-refresh'

interface PromptErrorParams {
  providerReason: string | null
  issue: ValidationIssue | undefined
  isAtLimit: boolean
  limitMessage: string
}

function promptError(params: PromptErrorParams): string | undefined {
  const { providerReason, issue, isAtLimit, limitMessage } = params

  if (isAtLimit) {
    return limitMessage
  }

  return providerReason ?? issueMessage(issue)
}

function issueMessage(issue?: ValidationIssue): string | undefined {
  if (isNil(issue)) {
    return undefined
  }

  return issueText(issue)
}

interface ImagePromptBarProps {
  activeCount: number
}

/** Floating bottom-center prompt bar for the image workspace. */
/* eslint-disable-next-line max-lines-per-function -- one prompt bar owns its draft, estimate and gate */
export function ImagePromptBar(props: ImagePromptBarProps) {
  const { activeCount } = props
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = barRef.current

    if (isNil(element)) {
      return
    }

    return registerPickerAnchor('image-prompt', element)
  }, [])

  const draft = useImageGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        prompt: state.prompt,
        count: state.count,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        quality: state.quality,
        background: state.background,
        seed: state.seed,
        references: state.references,
      }
    }),
  )

  const isUploadsLoading = useImageUploadsRefresh(draft.references)

  const preset = currentImagePreset(draft.presetId)
  const input = { ...draft }

  const settingsIssues = validateImageSettings(preset, input)
  const issues = [...settingsIssues, ...validateImagePrompt(preset, input.prompt)]
  const warnings = imageWarnings(preset, input)

  const blocking = issues.filter((issue) => {
    return !warnings.some((warning) => {
      return warning.type === 'text' && issue.type === 'text' && warning.text === issue.text
    })
  })

  const provider = useProviderReady(draft.presetId, 'image')
  const entry = useModelEntry(draft.presetId)
  const isAtLimit = activeCount >= IMAGE_MAX_ACTIVE
  const isDisabled = issues.length > 0 || !provider.isReady || isAtLimit
  const isSettingsValid = settingsIssues.length === 0
  const [first] = blocking.length > 0 ? blocking : warnings
  const limitMessage = `${IMAGE_MAX_ACTIVE} images already generating. Wait for one to finish.`

  const promptReason = promptError({
    providerReason: provider.reason,
    issue: first,
    isAtLimit,
    limitMessage,
  })

  const estimate = useImageEstimate(isSettingsValid)
  const priceUsd = estimate.usd ?? 0
  const isPriceVisible = isPriceVisibleFor(entry, priceUsd)

  const gate = useSubmitGate({
    isValid: issues.length === 0,
    isReady: provider.isReady,
    isAtLimit,
    isPriceLoading: estimate.isLoading,
    price: estimate.usd,
    limitMessage,
  })

  let error = promptReason

  if (isNil(error) && isPriceReason(gate.reason)) {
    error = gate.reason ?? undefined
  }

  const submission = useImageSubmit({ canSubmit: gate.canSubmit })

  const handleGenerate = (): void => {
    if (gate.canSubmit) {
      void submission.submit()
    }
  }

  return (
    <div data-image-prompt-bar className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div ref={barRef} className="w-full max-w-220">
        <div className="rounded-panel bg-surface p-1 shadow-[0_32px_24px_rgba(0,0,0,0.15)]">
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
            <ImageReferences isUploadsLoading={isUploadsLoading} />

            <div className="flex min-w-0 items-end gap-3">
              <ImagePromptControls preset={preset} onSubmit={handleGenerate} warnings={warnings} />

              <GenerateButton
                variant="compact"
                onGenerate={handleGenerate}
                isGenerating={submission.isSubmitting}
                isPriceLoading={estimate.isLoading}
                disabled={isDisabled}
                error={error}
                price={estimate.usd}
                isPriceVisible={isPriceVisible}
                isApproximate={estimate.isApproximate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
