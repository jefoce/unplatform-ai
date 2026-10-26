'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { noop } from 'lodash-es'
import { Settings } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { getPreset } from '@/core/presets'
import { pricePerSec } from '@/core/pricing'
import { openSettings } from '@/features/settings/settings-store'
import { useModelEntry } from '@/lib/api/models'

import { CreditsBadge } from '../credits/CreditsBadge'
import { FrameSlots } from '../frames/FrameSlots'
import { GenerateButton } from '../generate/GenerateButton'
import { useGenerate } from '../generate/use-generate'
import { usePanelPrice } from '../generate/use-panel-price'
import { ModelPicker } from '../model/ModelPicker'
import { PromptField } from '../prompt/PromptField'
import { ReferencesBox } from '../references/ReferencesBox'
import { useGeneratorStore } from '../store/store'
import { hasVideoReference } from '../store/store-helpers'
import { ModeTabs } from './ModeTabs'
import { SettingsRow } from './SettingsRow'
import { usePanelDraft } from './use-panel-draft'
import { usePanelPaste, useUploadsRefresh } from './use-panel-uploads'

const emptySubscribe = () => {
  return noop
}

const getMounted = () => {
  return true
}

const getUnmounted = () => {
  return false
}

interface PanelPrice {
  price: number | null
  listPrice: number | null
  discount: number
  isLoading: boolean
}

/** Estimate while enabled, catalog rate from the active preset otherwise. */
function usePanelPricing(isReady: boolean): PanelPrice {
  const { presetId, resolution, aspectRatio, isAudio, hasVideoInput } = useGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        resolution: state.resolution,
        aspectRatio: state.aspectRatio,
        isAudio: state.audio,
        hasVideoInput: hasVideoReference(state),
      }
    }),
  )

  const estimate = usePanelPrice(isReady)
  const preset = getPreset(presetId)
  const pricing = useModelEntry(presetId)?.pricing
  const ctx = { resolution, aspect: aspectRatio, audio: isAudio, hasVideoInput }
  const catalogDiscount = pricing?.discount ?? 0
  const catalogPrice = pricePerSec({ preset, ctx, skus: pricing?.skus })
  let catalogListPrice: number | null = null

  if (catalogDiscount > 0) {
    catalogListPrice = pricePerSec({ preset, ctx, skus: pricing?.listSkus })
  }

  if (isReady) {
    return estimate
  }

  return {
    price: catalogPrice,
    listPrice: catalogListPrice,
    discount: catalogDiscount,
    isLoading: estimate.isLoading,
  }
}

function handleOpenSettings(): void {
  openSettings()
}

/** Left generate panel: tabs, prompt, settings, warnings, generate. */
export function GeneratorPanel() {
  const tab = useGeneratorStore((state) => {
    return state.tab
  })

  const { validation, isKeyMissing, isSecretsFailed } = usePanelDraft()
  const { handlePaste } = usePanelPaste()
  const isReady = validation.ok && !isSecretsFailed
  const { price, listPrice, discount, isLoading: isPriceLoading } = usePanelPricing(isReady)
  const { generate, isGenerating } = useGenerate()

  const isMounted = useSyncExternalStore(emptySubscribe, getMounted, getUnmounted)

  useUploadsRefresh()

  const handleSubmit = useCallback((): void => {
    if (validation.ok) {
      void generate()
    }
  }, [validation.ok, generate])

  if (!isMounted) {
    return <div className="h-full" />
  }

  const Body = tab === 'frames' ? FrameSlots : ReferencesBox

  return (
    <div
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-panel"
      onPaste={handlePaste}
    >
      <div
        id="generator-panel"
        data-generator-panel
        className="min-h-0 flex-1 overflow-y-auto px-2 pt-3"
      >
        <div className="mb-6 flex h-9 items-center justify-between">
          <span className="relative ml-1 flex h-full items-center pb-2 text-sm font-medium">
            Create Video
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Settings"
              onClick={handleOpenSettings}
              className="relative inline-flex size-7 items-center justify-center rounded-lg border border-white/8 bg-white/2 text-fg-2 hover:bg-hover hover:text-fg"
            >
              <Settings size={14} aria-hidden />
              {isKeyMissing && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger" />
              )}
            </button>
            <CreditsBadge />
          </div>
        </div>
        <ModeTabs />
        <div className="mb-4">
          <Body />
        </div>
        <PromptField onSubmit={handleSubmit} warnings={validation.warnings} />
        <ModelPicker />
        <SettingsRow />
      </div>
      <div className="px-4 py-3">
        <GenerateButton
          onGenerate={handleSubmit}
          isGenerating={isGenerating}
          isPriceLoading={isPriceLoading}
          disabled={!isReady}
          error={validation.errors[0]}
          price={price}
          listPrice={listPrice}
          discount={discount}
        />
      </div>
    </div>
  )
}
