import { describe, expect, it } from 'vitest'

import { STATUS_HELP, statusHelpKey, statusHelpText } from '@/core/status-help'
import type { GenerationRecord } from '@/core/types'

type StatusInput = Pick<GenerationRecord, 'status' | 'submit' | 'download'>

const state = (overrides: Partial<StatusInput> = {}): StatusInput => ({
  status: 'submitting',
  ...overrides,
})

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
    expect(statusHelpKey(state({ status: 'pending' }))).toBe('in_queue')
    expect(statusHelpKey(state({ status: 'in_progress' }))).toBe('generating')
    expect(statusHelpKey(state({ status: 'completed' }))).toBe('completed')
    expect(statusHelpKey(state({ status: 'failed' }))).toBe('failed')
    expect(statusHelpKey(state({ status: 'expired' }))).toBe('expired')
    expect(statusHelpKey(state({ status: 'cancelled' }))).toBe('cancelled')
  })
})
