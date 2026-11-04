'use client'

import { useEffect } from 'react'
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  PASTE_COMMAND,
} from 'lexical'

import type { MediaKindCounts } from '@/core/media/media-types'

import { $convertLiteralMentions, $nodesFromText } from './prompt-convert'

interface PasteParams {
  editor: LexicalEditor
  event: Event
  isReferences: boolean
  counts: MediaKindCounts
}

/** Pastes plain text as slot chips on the References tab. */
function handlePaste(params: PasteParams): boolean {
  const { editor, event, isReferences, counts } = params
  const data = (event as ClipboardEvent).clipboardData

  if (!data || data.files.length > 0) {
    return false
  }

  if (data.types.includes('application/x-lexical-editor')) {
    return false
  }

  const text = data.getData('text/plain')

  if (text === '' || !isReferences) {
    return false
  }

  event.preventDefault()

  editor.update(() => {
    const selection = $getSelection()

    if (!$isRangeSelection(selection)) {
      return
    }

    selection.insertNodes($nodesFromText(text, counts))
  })

  return true
}

interface PromptEditorCommandsParams {
  editor: LexicalEditor
  onSubmit: () => void
  isReferences: boolean
  counts: MediaKindCounts
}

/** Editor commands: submit shortcut, paste handling and blur conversion. */
export function usePromptEditorCommands(params: PromptEditorCommandsParams) {
  const { editor, onSubmit, isReferences, counts } = params

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event?.metaKey !== true && event?.ctrlKey !== true) {
          return false
        }

        event.preventDefault()
        onSubmit()

        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor, onSubmit])

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        return handlePaste({ editor, event, isReferences, counts })
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor, isReferences, counts])

  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        if (!isReferences) {
          return false
        }

        editor.update(() => {
          $convertLiteralMentions(counts, isReferences)
        })

        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isReferences, counts])
}
