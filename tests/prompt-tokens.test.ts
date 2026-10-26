import { describe, expect, it } from 'vitest'

import type { MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import {
  canonicalizePrompt,
  idForSlot,
  missingSlots,
  parsePromptParts,
  type PromptPart,
  promptSlots,
  referenceSlots,
  renderPromptForApi,
  serializeParts,
  slotLabel,
  slotToken,
} from '@/core/prompt-tokens'
import type { Dict } from '@/core/utility-types'

const counts = (image = 0, video = 0, audio = 0): Record<MediaKind, number> => {
  return {
    image,
    video,
    audio,
  }
}

const text = (value: string): PromptPart => {
  return { type: 'text', text: value }
}

const slot = (kind: MediaKind, n: number): PromptPart => {
  return { type: 'slot', slot: { kind, n } }
}

describe('slot labels', () => {
  it('formats labels and stored tokens', () => {
    expect(slotLabel({ kind: 'image', n: 2 })).toBe('Image 2')
    expect(slotToken({ kind: 'video', n: 1 })).toBe('@Video 1')
  })
})

describe('parsePromptParts', () => {
  it('parses canonical tokens and round trips', () => {
    const prompt = 'The man from @Image 1 holds @Image 2 in @Video 1.'
    const parts = parsePromptParts(prompt, counts(2, 1))

    expect(parts).toEqual([
      text('The man from '),
      slot('image', 1),
      text(' holds '),
      slot('image', 2),
      text(' in '),
      slot('video', 1),
      text('.'),
    ])

    expect(serializeParts(parts)).toBe(prompt)
  })

  it('keeps line breaks in text parts', () => {
    expect(parsePromptParts('A\n@Image 1\nB', counts(1))).toEqual([
      text('A\n'),
      slot('image', 1),
      text('\nB'),
    ])
  })

  it('parses loose at and bracket forms even when missing', () => {
    expect(parsePromptParts('@image1', counts())).toEqual([slot('image', 1)])
    expect(parsePromptParts('@Img 2', counts())).toEqual([slot('image', 2)])
    expect(parsePromptParts('[Image 1]', counts())).toEqual([slot('image', 1)])
    expect(parsePromptParts('[image 1]', counts())).toEqual([slot('image', 1)])
  })

  it('parses a bare label only when the slot is attached', () => {
    expect(parsePromptParts('Image 1.', counts(1))).toEqual([slot('image', 1), text('.')])
    expect(parsePromptParts('Image 1.', counts())).toEqual([text('Image 1.')])
    expect(parsePromptParts('image 1', counts(1))).toEqual([text('image 1')])
  })

  it('never splits a longer number', () => {
    expect(parsePromptParts('Image 12', counts(2))).toEqual([text('Image 12')])
    expect(parsePromptParts('Image 12', counts(12))).toEqual([slot('image', 12)])
  })

  it('leaves legacy id tokens as text', () => {
    expect(parsePromptParts('Look at @[ref:a]', counts(1))).toEqual([text('Look at @[ref:a]')])
  })
})

describe('promptSlots', () => {
  it('returns unique canonical slots only', () => {
    expect(promptSlots('@Image 1 and @Image 1 and @Video 2 and Image 3')).toEqual([
      { kind: 'image', n: 1 },
      { kind: 'video', n: 2 },
    ])
  })
})

describe('missingSlots', () => {
  it('counts per kind and dedupes', () => {
    const prompt = '@Image 1 @Image 2 @Image 5 @Image 5 @Video 2'

    expect(missingSlots(prompt, counts(2, 0))).toEqual([
      { kind: 'image', n: 5 },
      { kind: 'video', n: 2 },
    ])

    expect(missingSlots(prompt, counts(2, 2))).toEqual([{ kind: 'image', n: 5 }])
  })
})

describe('renderPromptForApi', () => {
  it('renders Wan labels without the at prefix', () => {
    expect(renderPromptForApi('The @Image 1 meets @Video 2', getPreset('wan-3.0'))).toBe(
      'The Image 1 meets Video 2',
    )
  })

  it('renders Seedance 2.5 labels with the at prefix', () => {
    expect(renderPromptForApi('The @Image 1 meets @Video 2', getPreset('seedance-2.5'))).toBe(
      'The @Image 1 meets @Video 2',
    )
  })

  it('keeps text without canonical tokens unchanged', () => {
    const prompt = 'A plain prompt\t\twith  spaces'

    expect(renderPromptForApi(prompt, getPreset('wan-3.0'))).toBe(prompt)
  })
})

describe('canonicalizePrompt', () => {
  it('converts loose forms to canonical tokens', () => {
    expect(canonicalizePrompt('@image1 and [Video 2] and @[ref:a]', counts(1))).toBe(
      '@Image 1 and @Video 2 and @[ref:a]',
    )
  })

  it('leaves unattached bare labels as text', () => {
    expect(canonicalizePrompt('Image 3 shows a man', counts(2))).toBe('Image 3 shows a man')
  })
})

describe('referenceSlots', () => {
  const kinds: Dict<MediaKind> = { i1: 'image', i2: 'image', v1: 'video', a1: 'audio' }

  const kindOf = (id: string): MediaKind | undefined => {
    return kinds[id]
  }

  it('numbers slots per kind in reference order', () => {
    const result = referenceSlots(['i1', 'v1', 'i2', 'a1'], kindOf)

    expect(result.counts).toEqual({ image: 2, video: 1, audio: 1 })

    expect([...result.slots]).toEqual([
      ['i1', { kind: 'image', n: 1 }],
      ['v1', { kind: 'video', n: 1 }],
      ['i2', { kind: 'image', n: 2 }],
      ['a1', { kind: 'audio', n: 1 }],
    ])
  })

  it('skips unknown ids without guessing a kind', () => {
    const result = referenceSlots(['i1', 'missing', 'v1'], kindOf)

    expect(result.counts).toEqual({ image: 1, video: 1, audio: 0 })
    expect(result.slots.has('missing')).toBe(false)
  })

  it('finds the id attached at a slot', () => {
    const { slots } = referenceSlots(['i1', 'v1', 'i2'], kindOf)

    expect(idForSlot(slots, { kind: 'image', n: 2 })).toBe('i2')
    expect(idForSlot(slots, { kind: 'audio', n: 1 })).toBeNull()
  })
})
