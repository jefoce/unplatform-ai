import { describe, expect, it } from 'vitest'

import { findImagePreset } from '../src/core/presets/image'
import { friendlyError } from '../src/core/provider-errors'
import { OPENROUTER_DESCRIPTOR } from '../src/core/providers/openrouter'

const HTTP_RULES = OPENROUTER_DESCRIPTOR.httpRules

interface ImageRuleCase {
  presetId: string
  raw: string
  title: string
  kind: string
}

const CASES: readonly ImageRuleCase[] = [
  {
    presetId: 'gemini-3.1-flash-image',
    raw: 'The prompt was blocked because it contains safety violations.',
    title: 'Gemini blocked the prompt for safety.',
    kind: 'content',
  },
  {
    presetId: 'gemini-3.1-flash-image',
    raw: 'Request contains prohibited content.',
    title: 'Gemini does not allow this prompt.',
    kind: 'content',
  },
  {
    presetId: 'gemini-3.1-flash-image',
    raw: 'Candidate was blocked due to RECITATION.',
    title: 'Gemini blocked the result as copied material.',
    kind: 'copyright',
  },
  {
    presetId: 'gemini-3.1-flash-image',
    raw: 'Request payload size exceeds the limit.',
    title: 'The reference images are too large.',
    kind: 'input',
  },
  {
    presetId: 'gpt-image-2',
    raw: 'moderation_blocked',
    title: 'OpenAI moderation blocked this request.',
    kind: 'content',
  },
  {
    presetId: 'gpt-image-2',
    raw: 'Your request violates our content policy.',
    title: 'OpenAI content policy blocked this request.',
    kind: 'content',
  },
  {
    presetId: 'gpt-image-2',
    raw: 'Invalid value for quality with size.',
    title: 'This quality and size combination is not supported.',
    kind: 'input',
  },
  {
    presetId: 'seedream-5-0-flash',
    raw: 'InputImageSensitiveContentDetected',
    title: "Seedream's content check flagged this request.",
    kind: 'content',
  },
  {
    presetId: 'seedream-5-0-flash',
    raw: 'input detection failed',
    title: "Seedream's input check rejected a reference.",
    kind: 'input',
  },
  {
    presetId: 'seedream-5-0-flash',
    raw: 'invalid image size',
    title: 'Seedream does not accept this image size.',
    kind: 'input',
  },
  {
    presetId: 'flux-3-image-klein',
    raw: 'safety_tolerance',
    title: 'FLUX moderation blocked this request.',
    kind: 'content',
  },
  {
    presetId: 'flux-3-image-klein',
    raw: 'invalid size',
    title: 'FLUX does not accept this image size.',
    kind: 'input',
  },
  {
    presetId: 'gpt-image-2',
    raw: 'This model does not support: seed',
    title: 'This model does not support one of the settings.',
    kind: 'input',
  },
]

const rulesFor = (presetId: string) => {
  return findImagePreset(presetId)?.errors ?? []
}

describe('image provider errors', () => {
  it('maps each family rule from its provider text', () => {
    for (const row of CASES) {
      const friendly = friendlyError({
        raw: row.raw,
        rules: rulesFor(row.presetId),
        httpRules: HTTP_RULES,
      })

      expect(friendly.title, row.raw).toBe(row.title)
      expect(friendly.kind, row.raw).toBe(row.kind)
    }
  })

  it('runs the HTTP table for credits, rate limit and server errors', () => {
    expect(
      friendlyError({ raw: 'upstream said no', rules: [], httpCode: 402, httpRules: HTTP_RULES })
        .title,
    ).toBe('Not enough OpenRouter credits.')

    expect(
      friendlyError({ raw: 'upstream said no', rules: [], httpCode: 429, httpRules: HTTP_RULES })
        .title,
    ).toBe('Too many requests to OpenRouter.')

    expect(
      friendlyError({ raw: 'upstream said no', rules: [], httpCode: 503, httpRules: HTTP_RULES })
        .title,
    ).toBe('No provider can run this request right now.')
  })
})
