'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { compact, isNil, noop } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { registerPickerAnchor } from '@/features/media-picker/picker/anchors'
import { useUploadsRefresh } from '@/lib/use-uploads-refresh'

import { FrameSlots } from '../frames/FrameSlots'
import { GenerateButton } from '../generate/GenerateButton'
import { useGenerate } from '../generate/use-generate'
import { usePanelPrice } from '../generate/use-panel-price'
import { isPriceReason, useSubmitGate } from '../generate/use-submit-gate'
import { ModelPicker } from '../model/ModelPicker'
import { isPriceVisibleFor } from '../model/price-visibility'
import { ReferencesBox } from '../references/ReferencesBox'
import { useGeneratorStore } from '../store/store'
import { ModeTabs } from './ModeTabs'
import { PanelHeader } from './PanelHeader'
import { PanelPrompt } from './PanelPrompt'
import { SettingsRow } from './SettingsRow'
import { usePanelDraft } from './use-panel-draft'

const emptySubscribe = () => {
  return noop
}

const getMounted = () => {
  return true
}

const getUnmounted = () => {
  return false
}

interface PanelErrorParams {
  validationError?: string
  providerReason: string | null
  priceReason: string | null
}

/** Provider reason first: unreachable, missing, stale, then validation and price. */
function panelError(params: PanelErrorParams): string | undefined {
  const { validationError, providerReason, priceReason } = params

  if (!isNil(providerReason)) {
    return providerReason
  }

  if (!isNil(validationError)) {
    return validationError
  }

  if (isPriceReason(priceReason)) {
    return priceReason ?? undefined
  }

  return undefined
}

/** Left generate panel: tabs, prompt, settings, warnings, generate. */
/* eslint-disable-next-line max-lines-per-function -- one panel owns its draft, price and gate */
export function GeneratorPanel() {
  const draft = usePanelDraft()

  const isReady = draft.validation.ok && draft.provider.isReady && !draft.isSecretsFailed

  const {
    price,
    listPrice,
    discount,
    isLoading: isPriceLoading,
  } = usePanelPrice(draft.settingsValidation.ok && !draft.isSecretsFailed)

  const gate = useSubmitGate({
    isValid: draft.validation.ok,
    isReady: draft.provider.isReady && !draft.isSecretsFailed,
    isAtLimit: false,
    isPriceLoading,
    price,
  })

  const priceUsd = price ?? 0
  const isPriceVisible = isPriceVisibleFor(draft.entry, priceUsd)

  const error = panelError({
    validationError: draft.validation.errors[0],
    providerReason: draft.provider.reason,
    priceReason: gate.reason,
  })

  const { generate, isGenerating } = useGenerate({ canSubmit: gate.canSubmit })

  const isMounted = useSyncExternalStore(emptySubscribe, getMounted, getUnmounted)

  const { tab, frames, references, upsertUploads } = useGeneratorStore(
    useShallow((state) => {
      return {
        tab: state.tab,
        frames: state.frames,
        references: state.references,
        upsertUploads: state.upsertUploads,
      }
    }),
  )

  const isUploadsLoading = useUploadsRefresh({
    ids: compact([frames.start, frames.end, ...references]),
    upsert: upsertUploads,
  })

  const handleSubmit = useCallback((): void => {
    if (gate.canSubmit) {
      void generate()
    }
  }, [gate.canSubmit, generate])

  const handlePanelRef = useCallback((element: HTMLDivElement | null) => {
    if (isNil(element)) {
      return
    }

    return registerPickerAnchor('generator', element)
  }, [])

  if (!isMounted) {
    return <div className="h-full" />
  }

  const isFrames = tab === 'frames'

  return (
    <div
      ref={handlePanelRef}
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-panel"
    >
      <div
        id="generator-panel"
        data-generator-panel
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-3"
      >
        <PanelHeader isKeyMissing={draft.isKeyMissing} />
        <ModeTabs />
        <div className="mb-4">
          {isFrames && <FrameSlots />}
          {!isFrames && <ReferencesBox isUploadsLoading={isUploadsLoading} />}
        </div>
        <PanelPrompt
          value={draft.prompt}
          onChange={draft.setPrompt}
          onSubmit={handleSubmit}
          warnings={draft.validation.warnings}
        />
        <ModelPicker />
        <SettingsRow />
      </div>
      <div className="px-4 py-3">
        <GenerateButton
          onGenerate={handleSubmit}
          isGenerating={isGenerating}
          isPriceLoading={isPriceLoading}
          disabled={!isReady}
          error={error}
          price={price}
          isPriceVisible={isPriceVisible}
          listPrice={listPrice}
          discount={discount}
        />
      </div>
    </div>
  )
}
