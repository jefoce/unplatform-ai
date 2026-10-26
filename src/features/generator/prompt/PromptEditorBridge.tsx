'use client'

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createNodeSelection,
  $getRoot,
  $isElementNode,
  $setSelection,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'
import { $isBeautifulMentionNode, useBeautifulMentions } from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { referenceSlots, type RefSlot, slotLabel } from '@/core/prompt-tokens'

import { useGeneratorStore } from '../store/store'
import { slotCounts } from '../store/store-helpers'
import {
  $convertLiteralMentions,
  buildEditor,
  mentionSlot,
  serializeEditor,
} from './prompt-convert'
import { usePromptEditorCommands } from './use-prompt-editor-commands'

interface PromptEditorBridgeProps {
  prompt: string
  onSubmit: () => void
}

interface FocusSlotParams {
  editor: LexicalEditor
  slot: RefSlot
  occurrence: number
}

/** Mention nodes matching a slot, in document order. */
function $chipsFor(slot: RefSlot): LexicalNode[] {
  const found: LexicalNode[] = []

  const walk = (node: LexicalNode) => {
    if ($isBeautifulMentionNode(node)) {
      const target = mentionSlot(node.getValue(), node.getData())

      if (target.kind === slot.kind && target.n === slot.n) {
        found.push(node)
      }

      return
    }

    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        walk(child)
      }
    }
  }

  walk($getRoot())

  return found
}

/** Selects the nth chip for a slot, scrolls to it and flashes it. */
function focusSlotInEditor(params: FocusSlotParams): void {
  const { editor, slot, occurrence } = params
  let key: string | null = null

  const handleUpdate = (): void => {
    if (!isNonEmptyString(key)) {
      return
    }

    editor.focus()
    const element = editor.getElementByKey(key)

    element?.scrollIntoView({ block: 'center', behavior: 'smooth' })

    element?.animate(
      [{ boxShadow: '0 0 0 2px var(--color-warn)' }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 900 },
    )

    editor.update(() => {
      $setSelection(null)
    })
  }

  editor.update(
    () => {
      const chips = $chipsFor(slot)

      if (chips.length === 0) {
        return
      }

      const target = chips.at(occurrence % chips.length)

      if (isNil(target)) {
        return
      }

      key = target.getKey()
      const selection = $createNodeSelection()

      selection.add(key)
      $setSelection(selection)
    },
    { onUpdate: handleUpdate },
  )
}

/** Editor side effects: draft sync, chip conversion, insertion and shortcuts. */
export function PromptEditorBridge(props: PromptEditorBridgeProps) {
  const { prompt } = props
  const [editor] = useLexicalComposerContext()
  const { insertMention } = useBeautifulMentions()

  const registerInserter = useGeneratorStore((state) => {
    return state.registerMentionInserter
  })

  const registerFocuser = useGeneratorStore((state) => {
    return state.registerSlotFocuser
  })

  const refsKey = useGeneratorStore((state) => {
    return [
      ...referenceSlots(state.references, (id) => {
        return state.uploadsById[id]?.kind
      }).slots,
    ]
      .map(([id, slot]) => {
        return `${id}:${slot.kind}`
      })
      .join(',')
  })

  useEffect(() => {
    if (serializeEditor(editor.getEditorState()) !== prompt) {
      editor.update(() => {
        buildEditor(prompt)
      })
    }
  }, [editor, prompt])

  useEffect(() => {
    const counts = slotCounts(useGeneratorStore.getState())

    editor.update(() => {
      $convertLiteralMentions(counts)
    })
  }, [editor, refsKey])

  useEffect(() => {
    registerInserter((slot) => {
      editor.focus()

      insertMention({
        trigger: '@',
        value: slotLabel(slot),
        focus: true,
        data: { kind: slot.kind, n: slot.n },
      })
    })

    return () => {
      registerInserter(null)
    }
  }, [editor, insertMention, registerInserter])

  useEffect(() => {
    registerFocuser((slot, occurrence) => {
      focusSlotInEditor({ editor, slot, occurrence })
    })

    return () => {
      registerFocuser(null)
    }
  }, [editor, registerFocuser])

  usePromptEditorCommands(editor, props.onSubmit)

  return null
}
