'use client'

import { useMemo } from 'react'
import { ImagePlus } from 'lucide-react'

import type { ImagePreset } from '@/core/presets/image/types'
import type { ValidationIssue } from '@/core/validation/common'
import { ModelPicker } from '@/features/generator/model/ModelPicker'
import { ClearDraftButton } from '@/features/generator/prompt/ClearDraftButton'
import { PromptField } from '@/features/generator/prompt/PromptField'
import { PromptWarnings } from '@/features/generator/prompt/PromptWarnings'
import { BAR_ICON_CLASSES } from '@/ui/Chip'

import { openReferencePicker } from './image-picker'
import { imagePickerModels } from './image-picker-models'
import { ImageCountStepper } from './ImageCountStepper'
import { ImageOptionsRow } from './options/ImageOptionsRow'
import { useImageGeneratorStore } from './store'
import { useClearImageDraft } from './use-clear-image-draft'

interface ImagePromptControlsProps {
  preset: ImagePreset
  onSubmit: () => void
  warnings: ValidationIssue[]
}

/** Prompt field and scrolling settings row beside the generate button. */
export function ImagePromptControls(props: ImagePromptControlsProps) {
  const { preset } = props

  const presetId = useImageGeneratorStore((state) => {
    return state.presetId
  })

  const count = useImageGeneratorStore((state) => {
    return state.count
  })

  const prompt = useImageGeneratorStore((state) => {
    return state.prompt
  })

  const references = useImageGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useImageGeneratorStore((state) => {
    return state.uploadsById
  })

  const setPreset = useImageGeneratorStore((state) => {
    return state.setPreset
  })

  const setCount = useImageGeneratorStore((state) => {
    return state.setCount
  })

  const setPrompt = useImageGeneratorStore((state) => {
    return state.setPrompt
  })

  const mentions = useMemo(() => {
    return { references, uploadsById }
  }, [references, uploadsById])

  const models = useMemo(() => {
    return imagePickerModels()
  }, [])

  const clear = useClearImageDraft()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div data-image-prompt-input className="relative">
        <PromptField
          value={prompt}
          onChange={setPrompt}
          onSubmit={props.onSubmit}
          placeholder="Describe the scene you imagine"
          editorClassName="block max-h-[20dvh] min-h-12 w-full overflow-y-auto py-2 text-sm/5 wrap-break-word whitespace-pre-wrap outline-none"
          isInline
          isReferences
          mentions={mentions}
        />

        <PromptWarnings
          warnings={props.warnings}
          className="pointer-events-auto absolute right-1 bottom-1 z-10 max-w-[70%]"
        />
      </div>

      <div data-image-controls className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <button
          type="button"
          data-add-reference
          aria-label="Add references"
          onClick={openReferencePicker}
          className={BAR_ICON_CLASSES}
        >
          <ImagePlus size={14} aria-hidden />
        </button>

        <ClearDraftButton variant="bar" isDisabled={clear.isDisabled} onClear={clear.clear} />

        <span aria-hidden className="h-4 w-px shrink-0 bg-divider" />

        <ModelPicker variant="bar" models={models} selectedId={presetId} onSelect={setPreset} />
        <ImageOptionsRow preset={preset} />
        <ImageCountStepper count={count} onChange={setCount} />
      </div>
    </div>
  )
}
