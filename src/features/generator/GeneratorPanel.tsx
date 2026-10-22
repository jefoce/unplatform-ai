'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Settings } from 'lucide-react'

import { openSettings } from '@/features/settings/settings-store'

import { CreditsBadge } from './CreditsBadge'
import { FrameSlots } from './FrameSlots'
import { GenerateButton } from './GenerateButton'
import { ModelPicker } from './ModelPicker'
import { ModeTabs } from './ModeTabs'
import { PromptField } from './PromptField'
import { ReferencesBox } from './ReferencesBox'
import { SettingsRow } from './SettingsRow'
import { useGeneratorStore } from './store'
import { useGenerate } from './use-generate'
import { usePanelDraft } from './use-panel-draft'
import { usePanelPrice } from './use-panel-price'
import { usePanelPaste, useUploadsRefresh } from './use-panel-uploads'

const noop = (): void => {}
const emptySubscribe = () => noop

function handleOpenSettings(): void {
  openSettings()
}

/** Left generate panel: tabs, prompt, settings, warnings, generate. */
export function GeneratorPanel() {
  const tab = useGeneratorStore((state) => state.tab)
  const { validation, isKeyMissing, isSecretsFailed } = usePanelDraft()
  const { handlePaste } = usePanelPaste()
  const { price, listPrice, discount, isLoading: isPriceLoading } = usePanelPrice()
  const { generate, isGenerating } = useGenerate()
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  useUploadsRefresh()

  const handleSubmit = useCallback((): void => {
    if (validation.ok) void generate()
  }, [validation.ok, generate])

  if (!isMounted) return <div className="h-full" />

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
        <div className="mb-4">{tab === 'frames' ? <FrameSlots /> : <ReferencesBox />}</div>
        <PromptField onSubmit={handleSubmit} warnings={validation.warnings} />
        <ModelPicker />
        <SettingsRow />
      </div>
      <div className="px-4 py-3">
        <GenerateButton
          onGenerate={handleSubmit}
          isGenerating={isGenerating}
          isPriceLoading={isPriceLoading}
          disabled={!validation.ok || isSecretsFailed}
          error={validation.errors[0]}
          price={price}
          listPrice={listPrice}
          discount={discount}
        />
      </div>
    </div>
  )
}
