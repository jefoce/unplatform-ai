import { describe, expect, it } from 'vitest'

import { STATUS_HELP, statusHelpKey } from '@/core/status-help'
import { endpointOfflineView, videoStatusView } from '@/features/history/status/status-view'

import { storedRecord } from './helpers/stored-record'

const SOURCE = {
  kind: 'custom' as const,
  instanceId: 'cu1',
  badge: 'CU1',
  presetTitle: 'Wan 2.2 I2V',
  workflowName: 'Wan 2.2',
  endpointLabel: 'Studio PC',
  local: true,
}

function custom(overrides: Parameters<typeof storedRecord>[1] = {}) {
  return storedRecord('custom-record', {
    provider: 'custom',
    source: SOURCE,
    status: 'in_progress',
    ...overrides,
  })
}

describe('custom job progress', () => {
  it('shows the provider percent in the pill', () => {
    const record = custom({
      progress: { percent: 45, node: 'KSampler', queuePosition: null, waitingOn: null },
    })

    const view = videoStatusView(record)

    expect(view.label).toBe('Generating 45%')
    expect(view.progressPercent).toBe(45)
  })

  it('maps comfyui_busy to the waiting label', () => {
    const record = custom({
      status: 'pending',
      progress: { percent: 0, node: null, queuePosition: null, waitingOn: 'comfyui_busy' },
    })

    expect(statusHelpKey(record)).toBe('waiting_comfyui')
    expect(STATUS_HELP.waiting_comfyui.label).toBe('Waiting for ComfyUI')
  })

  it('shows the queue position when the pack reports one', () => {
    const record = custom({
      status: 'pending',
      progress: { percent: 0, node: null, queuePosition: 2, waitingOn: 'pack_queue' },
    })

    expect(videoStatusView(record).label).toBe('In queue, 2 ahead')
  })

  it('maps a comfy_unavailable error to the offline label', () => {
    const record = custom({ error: 'upai:comfy_unavailable: connection refused' })

    expect(statusHelpKey(record)).toBe('endpoint_unreachable')
  })

  it('replaces the active view with the offline view', () => {
    const view = endpointOfflineView(videoStatusView(custom()))

    expect(view.label).toBe('ComfyUI offline, will resume')
    expect(view.tone).toBe('gray')
    expect(view.error).toBeNull()
  })
})
