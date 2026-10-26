'use client'

import { isNil } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'

import { type ActionKey, type PreviewActions } from './preview-store'
import { PreviewActionButton } from './PreviewActionButton'

interface PreviewAction {
  key: ActionKey
  label: string
}

const ACTIONS: PreviewAction[] = [
  { key: 'insert', label: 'Insert in prompt' },
  { key: 'replace', label: 'Replace' },
  { key: 'remove', label: 'Remove' },
  { key: 'select', label: 'Select' },
  { key: 'deselect', label: 'Deselect' },
  { key: 'useAsStart', label: 'Use as start frame' },
  { key: 'addAsReference', label: 'Add as reference' },
]

const ACTION_VARIANT: Partial<Record<ActionKey, 'primary' | 'danger'>> = {
  insert: 'primary',
  remove: 'danger',
}

interface PreviewFooterProps {
  item: UploadItem | undefined
  actions: PreviewActions | undefined
  onRun: (key: ActionKey) => void
}

/** Opener actions that apply to the current item. */
export function PreviewFooter(props: PreviewFooterProps) {
  const { item, actions } = props

  if (!item) {
    return null
  }

  const available = actions?.available?.(item)

  const isVisible = (action: (typeof ACTIONS)[number]) => {
    return !isNil(actions?.[action.key]) && (isNil(available) || available.includes(action.key))
  }

  const provided = ACTIONS.filter(isVisible)

  if (provided.length === 0) {
    return null
  }

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
      {provided.map(({ key, label }) => {
        return (
          <PreviewActionButton
            key={key}
            actionKey={key}
            label={label}
            variant={ACTION_VARIANT[key]}
            onRun={props.onRun}
          />
        )
      })}
    </footer>
  )
}
