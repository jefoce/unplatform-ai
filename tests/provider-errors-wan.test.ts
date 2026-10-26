import { describe, expect, it } from 'vitest'

import { friendlyError } from '@/core/provider-errors'
import { OPENROUTER_DESCRIPTOR } from '@/core/providers/openrouter'

const HTTP_RULES = OPENROUTER_DESCRIPTOR.httpRules

const REAL_PERSON =
  "InputImageSensitiveContentDetected.PrivacyInformation: The request failed because the input image 'content[1]' may contain real person. Request id: 0217925672818..."

const CONTROL_ROWS: Array<{ raw: string; title: string; kind: string; retry?: boolean }> = [
  {
    raw: 'DataInspectionFailed: Output data may contain inappropriate content.',
    title: "The finished video was blocked by Wan's content check.",
    kind: 'content',
  },
  {
    raw: 'DataInspectionFailed: Input data may contain inappropriate content.',
    title: "Wan's content check flagged your prompt or a reference.",
    kind: 'content',
  },
  {
    raw: 'green network verification failed',
    title: "Wan's content check flagged a reference image.",
    kind: 'content',
  },
  {
    raw: 'IPInfringementSuspect: brand',
    title: 'Your prompt or references may be copyrighted.',
    kind: 'copyright',
  },
  {
    raw: 'CustomRoleBlocked: blocked',
    title: 'The request was blocked by a provider rule.',
    kind: 'content',
  },
  {
    raw: 'InvalidFile.Size: too large',
    title: 'A reference file is too large for Wan.',
    kind: 'input',
  },
  {
    raw: 'InvalidFile.Format: bad format',
    title: 'Wan does not accept one of the file formats.',
    kind: 'input',
  },
  {
    raw: 'InvalidFile.Duration: bad length',
    title: 'A reference clip is too short or too long.',
    kind: 'input',
  },
  {
    raw: 'InvalidImageResolution: bad size',
    title: "A reference does not fit Wan's size, shape or frame rate limits.",
    kind: 'input',
  },
  {
    raw: 'InvalidFile.Openerror: broken',
    title: 'Wan could not open one of the references.',
    kind: 'input',
  },
  {
    raw: 'InvalidParameter.DataInspection: check failed',
    title: 'Wan could not download a reference from your storage.',
    kind: 'input',
  },
  {
    raw: 'InvalidParameter: resolution 9000p',
    title: 'Wan rejected a setting: resolution.',
    kind: 'input',
  },
  {
    raw: 'Throttling.User: too fast',
    title: 'Wan is busy right now.',
    kind: 'busy',
    retry: true,
  },
  {
    raw: 'Arrearage: pay up',
    title: "The provider refused the request on OpenRouter's side.",
    kind: 'account',
  },
  {
    raw: 'InternalError.Algo: retry',
    title: 'Wan had an internal error.',
    kind: 'provider',
    retry: true,
  },
]

const HTTP_ROWS: Array<[number, string, string]> = [
  [400, 'OpenRouter rejected the request.', 'input'],
  [401, 'Your OpenRouter key is not valid.', 'account'],
  [402, 'Not enough OpenRouter credits.', 'account'],
  [403, 'Flagged by moderation.', 'content'],
  [408, 'OpenRouter timed out.', 'provider'],
  [429, 'Too many requests to OpenRouter.', 'busy'],
  [502, 'The model is down right now.', 'provider'],
  [503, 'No provider can run this request right now.', 'provider'],
]

describe('friendlyError Wan', () => {
  it('maps Wan codes and phrases', () => {
    for (const row of CONTROL_ROWS) {
      const friendly = friendlyError({ httpRules: HTTP_RULES, raw: row.raw, family: 'wan' })

      expect(friendly.title, row.raw).toBe(row.title)
      expect(friendly.kind, row.raw).toBe(row.kind)
      expect(friendly.retry, row.raw).toBe(row.retry ?? false)
    }
  })

  it('falls back to OpenRouter HTTP codes when no family code matches', () => {
    for (const [code, title, kind] of HTTP_ROWS) {
      const friendly = friendlyError({
        httpRules: HTTP_RULES,
        raw: 'upstream said no',
        family: null,
        httpCode: code,
      })

      expect(friendly.title, String(code)).toBe(title)
      expect(friendly.kind, String(code)).toBe(kind)
    }

    expect(
      friendlyError({ httpRules: HTTP_RULES, raw: REAL_PERSON, family: 'seedance', httpCode: 400 })
        .kind,
    ).toBe('real_person')
  })

  it('maps app errors', () => {
    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'Interrupted while sending. Check OpenRouter activity',
        family: 'wan',
      }).kind,
    ).toBe('app')

    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'OpenRouter copy expired before download',
        family: 'wan',
      }).title,
    ).toBe('The finished video was not saved.')

    expect(
      friendlyError({ httpRules: HTTP_RULES, raw: 'Disk is full. Free some space', family: 'wan' })
        .kind,
    ).toBe('app')

    expect(
      friendlyError({
        httpRules: HTTP_RULES,
        raw: 'OpenRouter key is not set. Open Settings.',
        family: 'wan',
      }).kind,
    ).toBe('account')
  })
})
