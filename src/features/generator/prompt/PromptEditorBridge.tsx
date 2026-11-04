'use client'

import { useEffect, useMemo } from 'react'
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
import type { MediaKindCounts } from '@/core/media/media-types'
import { referenceSlots, type RefSlot, slotLabel } from '@/core/prompt-tokens'

import {
  $convertLiteralMentions,
  buildEditor,
  mentionSlot,
  type PromptMentionInserter,
  type PromptMentions,
  type PromptSlotFocuser,
  serializeEditor,
} from './prompt-convert'
import { usePromptEditorCommands } from './use-prompt-editor-commands'

const EMPTY_COUNTS: MediaKindCounts = { image: 0, video: 0, audio: 0 }

interface PromptEditorBridgeProps {
  prompt: string
  onSubmit: () => void
  isReferences: boolean
  mentions: PromptMentions | null
  onRegisterInserter?: (fn: PromptMentionInserter | null) => void
  onRegisterFocuser?: (fn: PromptSlotFocuser | null) => void
}

interface FocusSlotParams {
  editor: LexicalEditor
  slot: RefSlot
  occurrence: number
}

interface MentionLayout {
  counts: MediaKindCounts
  refsKey: string
}

/** Counts and reference identity for one mention source. */
function mentionLayout(mentions: PromptMentions | null): MentionLayout {
  if (isNil(mentions)) {
    return { counts: EMPTY_COUNTS, refsKey: '' }
  }

  const { counts, slots } = referenceSlots(mentions.references, (id) => {
    return mentions.uploadsById[id]?.kind
  })

  const refsKey = [...slots]
    .map(([id, slot]) => {
      return `${id}:${slot.kind}`
    })
    .join(',')

  return { counts, refsKey }
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
  const { prompt, isReferences, mentions, onRegisterInserter, onRegisterFocuser } = props
  const [editor] = useLexicalComposerContext()
  const { insertMention } = useBeautifulMentions()

  const layout = useMemo(() => {
    return mentionLayout(mentions)
  }, [mentions])

  const isActive = isReferences && !isNil(mentions)

  useEffect(() => {
    if (serializeEditor(editor.getEditorState()) !== prompt) {
      editor.update(() => {
        buildEditor({ prompt, isReferences, counts: layout.counts })
      })
    }
  }, [editor, prompt, isReferences, layout])

  useEffect(() => {
    editor.update(() => {
      $convertLiteralMentions(layout.counts, isReferences)
    })
  }, [editor, layout.refsKey, isReferences, layout.counts])

  useEffect(() => {
    if (!isActive || isNil(onRegisterInserter)) {
      return
    }

    onRegisterInserter((slot) => {
      editor.focus()

      insertMention({
        trigger: '@',
        value: slotLabel(slot),
        focus: true,
        data: { kind: slot.kind, n: slot.n },
      })
    })

    return () => {
      onRegisterInserter(null)
    }
  }, [editor, insertMention, onRegisterInserter, isActive])

  useEffect(() => {
    if (!isActive || isNil(onRegisterFocuser)) {
      return
    }

    onRegisterFocuser((slot, occurrence) => {
      focusSlotInEditor({ editor, slot, occurrence })
    })

    return () => {
      onRegisterFocuser(null)
    }
  }, [editor, onRegisterFocuser, isActive])

  usePromptEditorCommands({
    editor,
    onSubmit: props.onSubmit,
    isReferences: isActive,
    counts: layout.counts,
  })

  return null
}
