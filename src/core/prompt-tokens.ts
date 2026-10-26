import { isNil } from 'lodash-es'

import { isNonEmptyString } from './guards'
import { KIND_TITLE } from './media-kinds'
import type { MediaKind, MediaKindCounts } from './media-types'
import type { ModelPreset } from './presets/types'
import type { Dict } from './utility-types'

export interface RefSlot {
  kind: MediaKind
  n: number
}

interface PromptTextPart {
  type: 'text'
  text: string
}

interface PromptSlotPart {
  type: 'slot'
  slot: RefSlot
}

export type PromptPart = PromptTextPart | PromptSlotPart

const KIND_WORD: Dict<MediaKind> = {
  image: 'image',
  img: 'image',
  video: 'video',
  audio: 'audio',
}

export const slotLabel = (slot: RefSlot): string => {
  return `${KIND_TITLE[slot.kind]} ${slot.n}`
}

export const slotToken = (slot: RefSlot): string => {
  return `@${slotLabel(slot)}`
}

const CANONICAL = /@(Image|Video|Audio) (\d{1,2})(?!\d)/g

const LOOSE =
  /@(image|img|video|audio)\s?(\d{1,2})(?!\d)|\[(image|img|video|audio)\s?(\d{1,2})\]|\b(Image|Video|Audio)\s(\d{1,2})(?!\d)/gi

export interface ReferenceSlotsResult {
  counts: MediaKindCounts
  slots: Map<string, RefSlot>
}

/** Slot per id in reference order. Unknown ids (not loaded yet, or deleted) are skipped. */
export function referenceSlots(
  ids: readonly string[],
  kindOf: (id: string) => MediaKind | undefined,
): ReferenceSlotsResult {
  const counts: MediaKindCounts = { image: 0, video: 0, audio: 0 }
  const slots = new Map<string, RefSlot>()

  for (const id of ids) {
    const kind = kindOf(id)

    if (isNil(kind)) {
      continue
    }

    counts[kind] += 1
    slots.set(id, { kind, n: counts[kind] })
  }

  return { counts, slots }
}

/** Id attached at a slot, or null. */
export function idForSlot(slots: Map<string, RefSlot>, slot: RefSlot): string | null {
  for (const [id, candidate] of slots) {
    if (candidate.kind === slot.kind && candidate.n === slot.n) {
      return id
    }
  }

  return null
}

/** Text -> parts. @ and [] forms always become slots. Bare "Image 1" only when that slot exists. */
export function parsePromptParts(text: string, counts: MediaKindCounts): PromptPart[] {
  const parts: PromptPart[] = []
  let last = 0

  for (const match of text.matchAll(LOOSE)) {
    const index = match.index ?? 0
    const slot = looseSlot(match, counts)

    if (!slot) {
      continue
    } // keep non-slot text untouched

    if (index > last) {
      parts.push({ type: 'text', text: text.slice(last, index) })
    }

    parts.push({ type: 'slot', slot })
    last = index + match[0].length
  }

  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) })
  }

  return parts
}

interface LooseMatch {
  word: string
  rawNumber: string
  isBare: boolean
  isCapitalized: boolean
}

function readLooseMatch(match: RegExpExecArray): LooseMatch | null {
  const [, atKind, atNum, bracketKind, bracketNum, bareKind, bareNum] = match
  const word = atKind ?? bracketKind ?? bareKind
  const rawNumber = atNum ?? bracketNum ?? bareNum

  if (!isNonEmptyString(word) || isNil(rawNumber)) {
    return null
  }

  return {
    word,
    rawNumber,
    isBare: isNil(atKind) && isNil(bracketKind),
    isCapitalized: /^[A-Z]/.test(bareKind ?? ''),
  }
}

/** Resolves a loose match to a slot, or null to leave it as text. */
function looseSlot(match: RegExpExecArray, counts: MediaKindCounts): RefSlot | null {
  const parsed = readLooseMatch(match)

  if (!parsed) {
    return null
  }

  const kind = KIND_WORD[parsed.word.toLowerCase()]
  const n = Number(parsed.rawNumber)

  if (isNil(kind) || n < 1 || n > 99) {
    return null
  }

  if (parsed.isBare && (!parsed.isCapitalized || n > counts[kind])) {
    return null
  }

  return { kind, n }
}

/** Stored form for parts (chips -> "@Image 1"). */
export function serializeParts(parts: readonly PromptPart[]): string {
  return parts
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      }

      return slotToken(part.slot)
    })
    .join('')
}

/** Unique slots mentioned in a stored prompt (canonical form only). */
export function promptSlots(prompt: string): RefSlot[] {
  const slots: RefSlot[] = []

  for (const match of prompt.matchAll(CANONICAL)) {
    const [, word, rawNumber] = match

    if (isNil(word) || isNil(rawNumber)) {
      continue
    }

    const kind = KIND_WORD[word.toLowerCase()]

    if (isNil(kind)) {
      continue
    }

    const slot = { kind, n: Number(rawNumber) }

    if (
      !slots.some((seen) => {
        return seen.kind === slot.kind && seen.n === slot.n
      })
    ) {
      slots.push(slot)
    }
  }

  return slots
}

/** Slots mentioned but not attached. */
export function missingSlots(prompt: string, counts: MediaKindCounts): RefSlot[] {
  return promptSlots(prompt).filter((slot) => {
    return slot.n > counts[slot.kind]
  })
}

/** API text: "@Image 1" -> preset.refLabel ("Image 1", "@Image 1", ...). */
export function renderPromptForApi(prompt: string, preset: ModelPreset): string {
  // eslint-disable-next-line @typescript-eslint/max-params -- fixed signature (String.replace)
  return prompt.replaceAll(CANONICAL, (_whole, kind: string, n: string) => {
    return preset.refLabel.replace('{Kind}', kind).replace('{n}', n)
  })
}

/** Canonicalize loose forms (used by the server and history migration). */
export function canonicalizePrompt(prompt: string, counts: MediaKindCounts): string {
  return serializeParts(parsePromptParts(prompt, counts))
}
