'use client'

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  PASTE_COMMAND,
} from 'lexical'
import { $isBeautifulMentionNode, useBeautifulMentions } from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import { referenceSlots, type RefSlot, slotLabel } from '@/core/prompt-tokens'

import {
  $convertLiteralMentions,
  $nodesFromText,
  buildEditor,
  mentionSlot,
  serializeEditor,
} from './prompt-convert'
import { slotCounts, useGeneratorStore } from './store'

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

      if (target.kind === slot.kind && target.n === slot.n) found.push(node)

      return
    }

    if ($isElementNode(node)) {
      for (const child of node.getChildren()) walk(child)
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
    if (isNil(key) || key === '') return

    editor.focus()
    const element = editor.getElementByKey(key)

    element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    element?.animate(
      [{ boxShadow: '0 0 0 2px var(--color-warn)' }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 900 },
    )
    editor.update(() => $setSelection(null))
  }

  editor.update(
    () => {
      const chips = $chipsFor(slot)

      if (chips.length === 0) return

      const target = chips[occurrence % chips.length]

      key = target.getKey()
      const selection = $createNodeSelection()

      selection.add(key)
      $setSelection(selection)
    },
    { onUpdate: handleUpdate },
  )
}

/** Pastes plain text as slot chips on the References tab. */
function handlePaste(editor: LexicalEditor, event: Event): boolean {
  const data = (event as ClipboardEvent).clipboardData

  if (!data || data.files.length > 0) return false

  if (data.types.includes('application/x-lexical-editor')) return false

  const text = data.getData('text/plain')

  if (text === '' || useGeneratorStore.getState().tab !== 'references') return false

  event.preventDefault()
  const counts = slotCounts(useGeneratorStore.getState())

  editor.update(() => {
    const selection = $getSelection()

    if (!$isRangeSelection(selection)) return

    selection.insertNodes($nodesFromText(text, counts))
  })

  return true
}

/** Editor side effects: draft sync, chip conversion, insertion and shortcuts. */
export function PromptEditorBridge(props: PromptEditorBridgeProps) {
  const { prompt, onSubmit } = props
  const [editor] = useLexicalComposerContext()
  const { insertMention } = useBeautifulMentions()
  const registerInserter = useGeneratorStore((state) => state.registerMentionInserter)
  const registerFocuser = useGeneratorStore((state) => state.registerSlotFocuser)
  const refsKey = useGeneratorStore((state) =>
    [...referenceSlots(state.references, (id) => state.uploadsById[id]?.kind).slots]
      .map(([id, slot]) => `${id}:${slot.kind}`)
      .join(','),
  )

  useEffect(() => {
    if (serializeEditor(editor.getEditorState()) !== prompt) {
      editor.update(() => buildEditor(prompt))
    }
  }, [editor, prompt])

  useEffect(() => {
    const counts = slotCounts(useGeneratorStore.getState())

    editor.update(() => $convertLiteralMentions(counts))
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

    return () => registerInserter(null)
  }, [editor, insertMention, registerInserter])

  useEffect(() => {
    registerFocuser((slot, occurrence) => focusSlotInEditor({ editor, slot, occurrence }))

    return () => registerFocuser(null)
  }, [editor, registerFocuser])

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (event?.metaKey !== true && event?.ctrlKey !== true) return false

          event.preventDefault()
          onSubmit()

          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSubmit],
  )

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => handlePaste(editor, event),
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  useEffect(
    () =>
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          const counts = slotCounts(useGeneratorStore.getState())

          editor.update(() => $convertLiteralMentions(counts))

          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  return null
}
