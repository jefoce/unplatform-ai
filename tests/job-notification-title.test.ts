import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyFailure } from '@/features/history/status/use-job-notifications'

const toastError = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: toastError } }
})

beforeEach(() => {
  toastError.mockReset()
})

describe('job notification titles', () => {
  it('uses the record snapshot title for a custom job', () => {
    notifyFailure({
      kind: 'video',
      status: 'failed',
      description: 'ComfyUI failed this job',
      subject: '[CU1] Wan 2.2 I2V',
    })

    expect(toastError).toHaveBeenCalledWith('[CU1] Wan 2.2 I2V', {
      description: 'ComfyUI failed this job',
    })
  })

  it('keeps the plain title without a snapshot', () => {
    notifyFailure({ kind: 'image', status: 'failed', description: 'boom' })

    expect(toastError).toHaveBeenCalledWith('Image failed', { description: 'boom' })
  })
})
