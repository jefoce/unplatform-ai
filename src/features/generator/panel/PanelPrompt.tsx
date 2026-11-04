'use client'

import type { ValidationIssue } from '@/core/validation/common'

import { ClearDraftButton } from '../prompt/ClearDraftButton'
import { PromptField } from '../prompt/PromptField'
import { useClearVideoDraft } from '../prompt/use-clear-video-draft'
import { usePanelMentions } from './use-panel-mentions'

interface PanelPromptProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  warnings: ValidationIssue[]
}

/** Video prompt field wired to the active tab and its mention source. */
export function PanelPrompt(props: PanelPromptProps) {
  const { value, warnings } = props
  const promptMentions = usePanelMentions()
  const clear = useClearVideoDraft()

  return (
    <PromptField
      value={value}
      onChange={props.onChange}
      onSubmit={props.onSubmit}
      warnings={warnings}
      footerEnd={<ClearDraftButton isDisabled={clear.isDisabled} onClear={clear.clear} />}
      {...promptMentions}
    />
  )
}
