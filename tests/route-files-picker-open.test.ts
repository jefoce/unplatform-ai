// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import { openReferencePicker } from '@/features/image-generator/image-picker'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { routeFiles } from '@/features/media-input/route-files'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerToggleMode,
} from '@/features/media-picker/picker/store'
import { uploadFiles } from '@/lib/api/uploads'

import type { UploadItem } from '../src/core/schemas/upload-item'
import { upload } from './helpers/validation-fixtures'

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

function toggleMode(): PickerToggleMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      throw new Error('hook called outside React')
    },
    getSelectedIds: () => {
      return useGeneratorStore.getState().references
    },
    useUploadsById: () => {
      return useGeneratorStore.getState().uploadsById
    },
    canAdd: () => {
      return null
    },
    onToggle: vi.fn(),
    onAdd: (item: UploadItem) => {
      useGeneratorStore.getState().addReferences([item])
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  closeMediaPicker()

  useGeneratorStore.setState({
    presetId: 'seedance-2.0',
    tab: 'references',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })

  useImageGeneratorStore.setState({ references: [], uploadsById: {} })
})

afterEach(closeMediaPicker)

describe('routeFiles with the picker open', () => {
  it('attaches a drop to the image draft without an invalid hook call', async () => {
    const first = upload('image-1', 'image')

    vi.mocked(uploadFiles).mockResolvedValue([first])
    openReferencePicker()

    await routeFiles([png])

    expect(useImageGeneratorStore.getState().references).toContain(first.id)
    expect(useGeneratorStore.getState().references).toHaveLength(0)
  })

  it('attaches a drop to the video draft without calling the selection hook', async () => {
    const first = upload('image-1', 'image')

    vi.mocked(uploadFiles).mockResolvedValue([first])
    openMediaPicker({ openerKey: 'test', kinds: ['image'], mode: toggleMode() })

    await routeFiles([png])

    expect(useGeneratorStore.getState().references).toContain(first.id)
    expect(useImageGeneratorStore.getState().references).toHaveLength(0)
  })
})
