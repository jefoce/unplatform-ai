import { describe, expect, it } from 'vitest'

import type { ProviderKindId } from '../src/core/providers/types'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { STATUS_HELP, statusHelpFor, statusHelpKey, statusHelpText } from '../src/core/status-help'

type StatusInput = Pick<GenerationRecord, 'status' | 'submit' | 'download'>

const state = (overrides: Partial<StatusInput> = {}): StatusInput => {
  return {
    status: 'submitting',
    ...overrides,
  }
}

const PROVIDERS = ['openrouter', 'custom'] as const satisfies readonly ProviderKindId[]

describe('status help', () => {
  it('covers every status with a label and help text', () => {
    for (const help of Object.values(STATUS_HELP)) {
      expect(help.label.length).toBeGreaterThan(0)
      expect(statusHelpText(help)).toContain(`Cancel: ${help.cancel}`)
    }
  })

  it('maps submit stages, download and finished states', () => {
    expect(statusHelpKey(state({ submit: { stage: 'grace' } }))).toBe('processing')
    expect(statusHelpKey(state({ submit: { stage: 'uploading' } }))).toBe('uploading')
    expect(statusHelpKey(state({ submit: { stage: 'sending' } }))).toBe('sending')

    expect(statusHelpKey(state({ status: 'in_progress', download: { startedAt: 'now' } }))).toBe(
      'downloading',
    )

    expect(statusHelpKey(state({ status: 'pending' }))).toBe('pending')
    expect(statusHelpKey(state({ status: 'in_progress' }))).toBe('generating')
    expect(statusHelpKey(state({ status: 'completed' }))).toBe('completed')
    expect(statusHelpKey(state({ status: 'failed' }))).toBe('failed')
    expect(statusHelpKey(state({ status: 'expired' }))).toBe('expired')
    expect(statusHelpKey(state({ status: 'cancelled' }))).toBe('cancelled')
  })

  it.each(['uploading', 'sending', 'pending'] as const)(
    'uses ComfyUI wording for custom %s',
    (key) => {
      const custom = statusHelpFor({ key, provider: 'custom' })
      const openrouter = statusHelpFor({ key, provider: 'openrouter' })

      expect(custom.what).toBe(
        {
          uploading: 'Sending your reference files to ComfyUI',
          sending: 'Handing the job to ComfyUI',
          pending: 'ComfyUI accepted it and is starting the workflow',
        }[key],
      )

      expect(openrouter.what).toBe(STATUS_HELP[key].what)
      expect(custom.label).toBe(openrouter.label)
    },
  )

  it.each(PROVIDERS)('keeps non-custom stages shared for %s', (provider) => {
    expect(statusHelpFor({ key: 'generating', provider }).what).toBe(STATUS_HELP.generating.what)
  })
})
