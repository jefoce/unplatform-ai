import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type EditorState,
  type LexicalNode,
} from 'lexical'
import {
  $createBeautifulMentionNode,
  $isBeautifulMentionNode,
  type BeautifulMentionsItemData,
} from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import { kindFromTitle, MEDIA_KINDS } from '@/core/media-kinds'
import {
  parsePromptParts,
  type PromptPart,
  type RefSlot,
  type SlotCounts,
  slotLabel,
  slotToken,
} from '@/core/prompt-tokens'
import type { MediaKind } from '@/core/types'
import { thumbUrl } from '@/features/media-picker/api'

import { type GeneratorState, slotCounts, uploadForSlot, useGeneratorStore } from './store'

const LABEL = /^(Image|Video|Audio) (\d+)$/

function slotFromData(data?: Record<string, BeautifulMentionsItemData>): RefSlot | null {
  const kind = MEDIA_KINDS.find((item) => item === String(data?.kind ?? ''))
  const n = Number(data?.n)

  if (isNil(kind) || !Number.isInteger(n) || n <= 0) return null

  return { kind, n }
}

/** Slot stored on a mention node, falling back to its label. */
export function mentionSlot(
  value: string,
  data?: Record<string, BeautifulMentionsItemData>,
): RefSlot {
  const fromData = slotFromData(data)

  if (!isNil(fromData)) return fromData

  const match = LABEL.exec(value)

  return { kind: kindFromTitle(match?.[1] ?? '') ?? 'image', n: Number(match?.[2] ?? 0) }
}

function serializeNode(node: LexicalNode): string {
  if ($isBeautifulMentionNode(node)) {
    return slotToken(mentionSlot(node.getValue(), node.getData()))
  }

  if ($isTextNode(node)) return node.getTextContent()

  if ($isLineBreakNode(node)) return '\n'

  if ($isElementNode(node)) return node.getChildren().map(serializeNode).join('')

  return ''
}

/** Stored prompt string for the current editor state. */
export function serializeEditor(state: EditorState): string {
  return state.read(() => $getRoot().getChildren().map(serializeNode).join('\n'))
}

export interface MentionItem {
  value: string
  kind: MediaKind
  n: number
  thumb: string | null
  [key: string]: string | number | null
}

/** One typeahead row per current slot, with its live thumb. */
export function mentionItems(state: Pick<GeneratorState, 'references' | 'uploadsById'>): {
  '@': MentionItem[]
} {
  const counts = slotCounts(state)
  const items: MentionItem[] = []

  for (const kind of MEDIA_KINDS) {
    for (let n = 1; n <= counts[kind]; n += 1) {
      const slot = { kind, n }
      const upload = uploadForSlot(state, slot)

      items.push({
        value: slotLabel(slot),
        kind,
        n,
        thumb: upload && kind !== 'audio' ? thumbUrl({ ref: `uploads/${upload.id}`, w: 32 }) : null,
      })
    }
  }

  return { '@': items }
}

function $partsToNodes(parts: readonly PromptPart[]): LexicalNode[] {
  const nodes: LexicalNode[] = []

  for (const part of parts) {
    if (part.type === 'slot') {
      nodes.push(
        $createBeautifulMentionNode('@', slotLabel(part.slot), {
          kind: part.slot.kind,
          n: part.slot.n,
        }),
      )
      continue
    }

    for (const [index, line] of part.text.split('\n').entries()) {
      if (index > 0) nodes.push($createLineBreakNode())

      if (line !== '') nodes.push($createTextNode(line))
    }
  }

  return nodes
}

/** Fills the editor from the stored prompt, converting slots on References. */
export function buildEditor(prompt: string): void {
  const state = useGeneratorStore.getState()
  let parts: PromptPart[]

  if (state.tab === 'references') {
    parts = parsePromptParts(prompt, slotCounts(state))
  } else {
    parts = [{ type: 'text', text: prompt }]
  }

  const root = $getRoot()

  root.clear()
  const paragraph = $createParagraphNode()

  for (const node of $partsToNodes(parts)) paragraph.append(node)

  root.append(paragraph)
}

/** Converts literal slot labels in text nodes to mention chips. */
export function $convertLiteralMentions(counts: SlotCounts): void {
  if (useGeneratorStore.getState().tab !== 'references') return

  for (const node of $getRoot().getAllTextNodes()) {
    const parts = parsePromptParts(node.getTextContent(), counts)

    if (!parts.some((part) => part.type === 'slot')) continue

    let anchor: LexicalNode = node

    for (const next of $partsToNodes(parts)) {
      anchor.insertAfter(next)
      anchor = next
    }

    node.remove()
  }
}

/** Nodes for pasted text: slots become chips, other text stays plain. */
export function $nodesFromText(text: string, counts: SlotCounts): LexicalNode[] {
  return $partsToNodes(parsePromptParts(text, counts))
}
