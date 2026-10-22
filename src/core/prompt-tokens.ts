import { isNil } from 'lodash-es'

import { KIND_TITLE } from './media-kinds'
import type { ModelPreset } from './presets'
import type { MediaKind } from './types'

export interface RefSlot {
  kind: MediaKind
  n: number
}
export type PromptPart = { type: 'text'; text: string } | { type: 'slot'; slot: RefSlot }

const KIND_WORD: Record<string, MediaKind> = {
  image: 'image',
  img: 'image',
  video: 'video',
  audio: 'audio',
}

export const slotLabel = (slot: RefSlot): string => `${KIND_TITLE[slot.kind]} ${slot.n}`
export const slotToken = (slot: RefSlot): string => `@${slotLabel(slot)}`

const CANONICAL = /@(Image|Video|Audio) (\d{1,2})(?!\d)/g
const LOOSE =
  /@(image|img|video|audio)\s?(\d{1,2})(?!\d)|\[(image|img|video|audio)\s?(\d{1,2})\]|\b(Image|Video|Audio)\s(\d{1,2})(?!\d)/gi

export type SlotCounts = Record<MediaKind, number>

/** Slot per id in reference order. Unknown ids (not loaded yet, or deleted) are skipped. */
export function referenceSlots(
  ids: readonly string[],
  kindOf: (id: string) => MediaKind | undefined,
): { counts: SlotCounts; slots: Map<string, RefSlot> } {
  const counts: SlotCounts = { image: 0, video: 0, audio: 0 }
  const slots = new Map<string, RefSlot>()

  for (const id of ids) {
    const kind = kindOf(id)

    if (isNil(kind)) continue

    counts[kind] += 1
    slots.set(id, { kind, n: counts[kind] })
  }

  return { counts, slots }
}

/** Id attached at a slot, or null. */
export function idForSlot(slots: Map<string, RefSlot>, slot: RefSlot): string | null {
  for (const [id, candidate] of slots) {
    if (candidate.kind === slot.kind && candidate.n === slot.n) return id
  }

  return null
}

/** Text -> parts. @ and [] forms always become slots. Bare "Image 1" only when that slot exists. */
export function parsePromptParts(text: string, counts: SlotCounts): PromptPart[] {
  const parts: PromptPart[] = []
  let last = 0

  for (const match of text.matchAll(LOOSE)) {
    const index = match.index ?? 0
    const slot = looseSlot(match, counts)

    if (!slot) continue // keep non-slot text untouched

    if (index > last) parts.push({ type: 'text', text: text.slice(last, index) })

    parts.push({ type: 'slot', slot })
    last = index + match[0].length
  }

  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })

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

  if (isNil(word) || word === '') return null

  return {
    word,
    rawNumber: atNum ?? bracketNum ?? bareNum,
    isBare: isNil(atKind) && isNil(bracketKind),
    isCapitalized: /^[A-Z]/.test(bareKind ?? ''),
  }
}

/** Resolves a loose match to a slot, or null to leave it as text. */
function looseSlot(match: RegExpExecArray, counts: SlotCounts): RefSlot | null {
  const parsed = readLooseMatch(match)

  if (!parsed) return null

  const kind = KIND_WORD[parsed.word.toLowerCase()]
  const n = Number(parsed.rawNumber)

  if (isNil(kind) || n < 1 || n > 99) return null

  if (parsed.isBare && (!parsed.isCapitalized || n > counts[kind])) return null

  return { kind, n }
}

/** Stored form for parts (chips -> "@Image 1"). */
export function serializeParts(parts: readonly PromptPart[]): string {
  return parts.map((part) => (part.type === 'text' ? part.text : slotToken(part.slot))).join('')
}

/** Unique slots mentioned in a stored prompt (canonical form only). */
export function promptSlots(prompt: string): RefSlot[] {
  const slots: RefSlot[] = []

  for (const match of prompt.matchAll(CANONICAL)) {
    const slot = { kind: KIND_WORD[match[1].toLowerCase()], n: Number(match[2]) }

    if (!slots.some((seen) => seen.kind === slot.kind && seen.n === slot.n)) slots.push(slot)
  }

  return slots
}

/** Slots mentioned but not attached. */
export function missingSlots(prompt: string, counts: SlotCounts): RefSlot[] {
  return promptSlots(prompt).filter((slot) => slot.n > counts[slot.kind])
}

/** API text: "@Image 1" -> preset.refLabel ("Image 1", "@Image 1", ...). */
export function renderPromptForApi(prompt: string, preset: ModelPreset): string {
  // eslint-disable-next-line @typescript-eslint/max-params -- fixed signature (String.replace)
  return prompt.replaceAll(CANONICAL, (_whole, kind: string, n: string) =>
    preset.refLabel.replace('{Kind}', kind).replace('{n}', n),
  )
}

/** Canonicalize loose forms (used by the server and history migration). */
export function canonicalizePrompt(prompt: string, counts: SlotCounts): string {
  return serializeParts(parsePromptParts(prompt, counts))
}
