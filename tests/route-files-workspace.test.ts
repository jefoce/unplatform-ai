// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { routeFiles } from '@/features/media-input/route-files'
import { closeMediaPicker } from '@/features/media-picker/picker/store'
import { uploadFiles } from '@/lib/api/uploads'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const toast = vi.hoisted(() => {
  return { skipped: vi.fn(), error: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: Object.assign(toast.skipped, { error: toast.error }) }
})

vi.mock('@/lib/api/uploads', () => {
  return { uploadFiles: vi.fn() }
})

const png = new File(['png'], 'a.png', { type: 'image/png' })

beforeEach(() => {
  vi.clearAllMocks()
  closeMediaPicker()
  window.history.replaceState(null, '', '/')

  useGeneratorStore.setState({
    presetId: 'seedance-2.0',
    tab: 'references',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })

  useImageGeneratorStore.setState({ references: [], uploadsById: {} })
})

afterEach(() => {
  closeMediaPicker()
  window.history.replaceState(null, '', '/')
})

describe('routeFiles by workspace', () => {
  it('adds a drop to the image draft in the image workspace', async () => {
    const first = upload('image-1', 'image')

    window.history.replaceState(null, '', '/?tab=image')
    vi.mocked(uploadFiles).mockResolvedValue([first])

    await routeFiles([png])

    expect(useImageGeneratorStore.getState().references).toContain(first.id)
    expect(useGeneratorStore.getState().references).toHaveLength(0)
  })

  it('keeps a video drop in the video draft', async () => {
    const first = upload('image-1', 'image')

    vi.mocked(uploadFiles).mockResolvedValue([first])

    await routeFiles([png])

    expect(useGeneratorStore.getState().references).toContain(first.id)
    expect(useImageGeneratorStore.getState().references).toHaveLength(0)
  })

  it('keeps the image reference cap and reports the skipped file', async () => {
    const existing = ['image-1', 'image-2', 'image-3'].map((id) => {
      return upload(id, 'image')
    })

    const added = upload('image-4', 'image')

    window.history.replaceState(null, '', '/?tab=image')

    useImageGeneratorStore.setState({
      presetId: 'gemini-2.5-flash-image',
      references: existing.map((item) => {
        return item.id
      }),
      uploadsById: uploadsOf(...existing),
    })

    vi.mocked(uploadFiles).mockResolvedValue([added])

    await routeFiles([png])

    expect(useImageGeneratorStore.getState().references).toHaveLength(3)
    expect(useImageGeneratorStore.getState().references).not.toContain(added.id)
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 1 file (Reference limit reached)')
  })

  it('rejects a video file in the image workspace before upload', async () => {
    const mp4 = new File(['mp4'], 'a.mp4', { type: 'video/mp4' })

    window.history.replaceState(null, '', '/?tab=image')

    await routeFiles([mp4])

    expect(uploadFiles).not.toHaveBeenCalled()
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 1 unsupported file')
  })
})
