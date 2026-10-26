import { describe, expect, it } from 'vitest'

import { friendlyError } from '@/core/provider-errors'
import { OPENROUTER_DESCRIPTOR } from '@/core/providers/openrouter'

const HTTP_RULES = OPENROUTER_DESCRIPTOR.httpRules

const REAL_PERSON =
  "InputImageSensitiveContentDetected.PrivacyInformation: The request failed because the input image 'content[1]' may contain real person. Request id: 0217925672818..."

const REAL_PERSON_VIDEO =
  "InputVideoSensitiveContentDetected.PrivacyInformation: The request failed because the input video 'content[0]' may contain real person."

const CONTROL_ROWS: Array<{ raw: string; title: string; kind: string; retry?: boolean }> = [
  {
    raw: 'InputVideoSensitiveContentDetected.PrivacyInformation: blocked',
    title: 'Seedance blocks videos that show real people.',
    kind: 'real_person',
  },
  {
    raw: 'InputImageSensitiveContentDetected.PolicyViolation: blocked',
    title: 'Your image may be copyrighted.',
    kind: 'copyright',
  },
  {
    raw: 'InputTextSensitiveContentDetected.PolicyViolation: blocked',
    title: 'Your prompt may be copyrighted.',
    kind: 'copyright',
  },
  {
    raw: 'OutputVideoSensitiveContentDetected.PolicyViolation: blocked',
    title: 'The result looked like copyrighted material and was blocked.',
    kind: 'copyright',
  },
  {
    raw: 'InputTextSensitiveContentDetected: blocked',
    title: "Seedance's content check flagged your prompt.",
    kind: 'content',
  },
  {
    raw: 'InputAudioSensitiveContentDetected: blocked',
    title: "Seedance's content check flagged a reference audio.",
    kind: 'content',
  },
  {
    raw: 'OutputVideoSensitiveContentDetected: blocked',
    title: "The finished video was blocked by Seedance's content check.",
    kind: 'content',
  },
  {
    raw: 'SensitiveContentDetected: blocked',
    title: "Seedance's content check flagged this request.",
    kind: 'content',
  },
  {
    raw: 'InvalidImageURL.InvalidFormat: bad image',
    title: 'Seedance could not read one of the images.',
    kind: 'input',
  },
  {
    raw: 'InvalidParameter.TaskTypeConstraint: mixed',
    title: 'Seedance does not accept this mix of frames and references.',
    kind: 'input',
  },
  {
    raw: 'InvalidParameter: duration is invalid',
    title: 'Seedance rejected a setting: duration.',
    kind: 'input',
  },
  {
    raw: 'MissingParameter.Frames',
    title: 'Seedance rejected a setting: Frames.',
    kind: 'input',
  },
  {
    raw: 'RateLimitExceeded: slow down',
    title: 'Seedance is busy right now.',
    kind: 'busy',
    retry: true,
  },
  {
    raw: 'InternalServiceError: try later',
    title: 'Seedance had an internal error.',
    kind: 'provider',
    retry: true,
  },
]

describe('friendlyError Seedance', () => {
  it('translates the two real Seedance 2.0 and 2.5 image strings', () => {
    for (const prefix of ['', 'Seedance 2.5: ']) {
      const raw = `${prefix}${REAL_PERSON}`

      expect(friendlyError({ httpRules: HTTP_RULES, raw, family: 'seedance' })).toEqual({
        title: 'Seedance blocks images that look like real people, even AI-made ones.',
        hint: 'Use a different image, or choose another model.',
        kind: 'real_person',
        retry: false,
        raw,
      })
    }
  })

  it('translates the real Seedance video string without naming another model', () => {
    expect(
      friendlyError({ httpRules: HTTP_RULES, raw: REAL_PERSON_VIDEO, family: 'seedance' }),
    ).toEqual({
      title: 'Seedance blocks videos that show real people.',
      hint: 'Use a different video, or choose another model.',
      kind: 'real_person',
      retry: false,
      raw: REAL_PERSON_VIDEO,
    })
  })

  it('matches specific codes before their parent code', () => {
    expect(
      friendlyError({ httpRules: HTTP_RULES, raw: REAL_PERSON, family: 'seedance' }).kind,
    ).toBe('real_person')

    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'InputImageSensitiveContentDetected: The request failed.',
        family: 'seedance',
      }).kind,
    ).toBe('content')
  })

  it('keeps Seedance and Wan families isolated', () => {
    expect(friendlyError({ httpRules: HTTP_RULES, raw: REAL_PERSON, family: 'wan' }).kind).toBe(
      'unknown',
    )

    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'DataInspectionFailed: Output data may contain inappropriate content.',
        family: 'seedance',
      }).kind,
    ).toBe('unknown')

    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'DataInspectionFailed: bad input',
        family: 'wan',
      }).kind,
    ).toBe('content')
  })

  it('returns the unknown fallback with the raw hint', () => {
    const raw = 'Something odd happened at the provider'

    expect(friendlyError({ httpRules: HTTP_RULES, raw, family: 'seedance' })).toEqual({
      title: 'Generation failed',
      hint: raw,
      kind: 'unknown',
      retry: false,
      raw,
    })
  })

  it('maps Seedance control codes', () => {
    for (const row of CONTROL_ROWS) {
      const friendly = friendlyError({ httpRules: HTTP_RULES, raw: row.raw, family: 'seedance' })

      expect(friendly.title, row.raw).toBe(row.title)
      expect(friendly.kind, row.raw).toBe(row.kind)
      expect(friendly.retry, row.raw).toBe(row.retry ?? false)
      expect(friendly.raw, row.raw).toBe(row.raw)
    }
  })
})
