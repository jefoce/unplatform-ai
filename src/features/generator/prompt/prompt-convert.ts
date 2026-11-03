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

import type { UploadsById } from '@/core/api/uploads'
import { kindFromTitle } from '@/core/media/media-kinds'
import { MEDIA_KINDS, type MediaKind, type MediaKindCounts } from '@/core/media/media-types'
import {
  normalizeMentionText,
  parsePromptParts,
  type PromptPart,
  type RefSlot,
  slotLabel,
  slotToken,
} from '@/core/prompt-tokens'
import type { Dict } from '@/core/utility-types'
import { thumbUrl } from '@/lib/api/media-urls'

import { slotCounts, uploadForSlot } from '../store/store-helpers'

const LABEL = /^(Image|Video|Audio) (\d+)$/

/** Mentions resolve against this source, never against the video store. */
export interface PromptMentions {
  references: string[]
  uploadsById: UploadsById
}

export type PromptMentionInserter = (slot: RefSlot) => void

export type PromptSlotFocuser = (slot: RefSlot, occurrence: number) => void

function slotFromData(data?: Dict<BeautifulMentionsItemData>): RefSlot | null {
  const kind = MEDIA_KINDS.find((item) => {
    return item === String(data?.kind ?? '')
  })

  const n = Number(data?.n)

  if (isNil(kind) || !Number.isInteger(n) || n <= 0) {
    return null
  }

  return { kind, n }
}

/** Slot stored on a mention node, falling back to its label. */
export function mentionSlot(value: string, data?: Dict<BeautifulMentionsItemData>): RefSlot {
  const fromData = slotFromData(data)

  if (!isNil(fromData)) {
    return fromData
  }

  const match = LABEL.exec(value)

  return { kind: kindFromTitle(match?.[1] ?? '') ?? 'image', n: Number(match?.[2] ?? 0) }
}

function serializeNode(node: LexicalNode): string {
  if ($isBeautifulMentionNode(node)) {
    return slotToken(mentionSlot(node.getValue(), node.getData()))
  }

  if ($isTextNode(node)) {
    return normalizeMentionText(node.getTextContent())
  }

  if ($isLineBreakNode(node)) {
    return '\n'
  }

  if ($isElementNode(node)) {
    return node.getChildren().map(serializeNode).join('')
  }

  return ''
}

/** Stored prompt string for the current editor state. */
export function serializeEditor(state: EditorState): string {
  return state.read(() => {
    return $getRoot().getChildren().map(serializeNode).join('\n')
  })
}

interface MentionItem {
  value: string
  kind: MediaKind
  n: number
  thumb: string | null
  [key: string]: string | number | null
}

interface MentionItemGroups {
  '@': MentionItem[]
  [key: string]: MentionItem[]
}

/** One typeahead row per current slot, with its live thumb. */
export function mentionItems(mentions: PromptMentions): MentionItemGroups {
  const counts = slotCounts(mentions)
  const items: MentionItem[] = []

  for (const kind of MEDIA_KINDS) {
    for (let n = 1; n <= counts[kind]; n += 1) {
      const slot = { kind, n }
      const upload = uploadForSlot(mentions, slot)
      let thumb: string | null = null

      if (!isNil(upload) && kind !== 'audio') {
        thumb = thumbUrl({ ref: `uploads/${upload.id}`, w: 32 })
      }

      items.push({
        value: slotLabel(slot),
        kind,
        n,
        thumb,
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
      if (index > 0) {
        nodes.push($createLineBreakNode())
      }

      if (line !== '') {
        nodes.push($createTextNode(line))
      }
    }
  }

  return nodes
}

interface BuildEditorParams {
  prompt: string
  isReferences: boolean
  counts: MediaKindCounts
}

/** Fills the editor from the stored prompt, converting slots on References. */
export function buildEditor(params: BuildEditorParams): void {
  const { prompt, isReferences, counts } = params
  let parts: PromptPart[]

  if (isReferences) {
    parts = parsePromptParts(prompt, counts)
  } else {
    parts = [{ type: 'text', text: normalizeMentionText(prompt) }]
  }

  const root = $getRoot()

  root.clear()
  const paragraph = $createParagraphNode()

  for (const node of $partsToNodes(parts)) {
    paragraph.append(node)
  }

  root.append(paragraph)
}

/** Converts literal slot labels in text nodes to mention chips. */
export function $convertLiteralMentions(counts: MediaKindCounts, isReferences: boolean): void {
  if (!isReferences) {
    return
  }

  for (const node of $getRoot().getAllTextNodes()) {
    const parts = parsePromptParts(node.getTextContent(), counts)

    if (
      !parts.some((part) => {
        return part.type === 'slot'
      })
    ) {
      continue
    }

    let anchor: LexicalNode = node

    for (const next of $partsToNodes(parts)) {
      anchor.insertAfter(next)
      anchor = next
    }

    node.remove()
  }
}

/** Nodes for pasted text: slots become chips, other text stays plain. */
export function $nodesFromText(text: string, counts: MediaKindCounts): LexicalNode[] {
  return $partsToNodes(parsePromptParts(text, counts))
}
