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

import { useGeneratorStore } from '../store/store'
import { slotCounts } from '../store/store-helpers'
import { $convertLiteralMentions, $nodesFromText } from './prompt-convert'

/** Pastes plain text as slot chips on the References tab. */
function handlePaste(editor: LexicalEditor, event: Event): boolean {
  const data = (event as ClipboardEvent).clipboardData

  if (!data || data.files.length > 0) {
    return false
  }

  if (data.types.includes('application/x-lexical-editor')) {
    return false
  }

  const text = data.getData('text/plain')

  if (text === '' || useGeneratorStore.getState().tab !== 'references') {
    return false
  }

  event.preventDefault()
  const counts = slotCounts(useGeneratorStore.getState())

  editor.update(() => {
    const selection = $getSelection()

    if (!$isRangeSelection(selection)) {
      return
    }

    selection.insertNodes($nodesFromText(text, counts))
  })

  return true
}

/** Editor commands: submit shortcut, paste handling and blur conversion. */
export function usePromptEditorCommands(editor: LexicalEditor, onSubmit: () => void) {
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
        return handlePaste(editor, event)
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        const counts = slotCounts(useGeneratorStore.getState())

        editor.update(() => {
          $convertLiteralMentions(counts)
        })

        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])
}
