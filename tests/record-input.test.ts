// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { applyRecordToGenerator } from '@/features/generator/record-input'
import { useGeneratorStore } from '@/features/generator/store/store'

import { record } from './helpers/history'
import { upload } from './helpers/validation-fixtures'

interface GenerationsModule {
  captureGenerationFrame: (id: string, at: 'first' | 'last') => Promise<UploadItem>
}

interface UploadsModule {
  linkGenerationFile: (params: { generationId: string }) => Promise<UploadItem>
}

const mocks = vi.hoisted(() => {
  return {
    captureGenerationFrame: vi.fn(),
    linkGenerationFile: vi.fn(),
  }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<GenerationsModule>()

  return { ...actual, captureGenerationFrame: mocks.captureGenerationFrame }
})

vi.mock('@/lib/api/uploads', async (importOriginal) => {
  const actual = await importOriginal<UploadsModule>()

  return { ...actual, linkGenerationFile: mocks.linkGenerationFile }
})

function resetGenerator(): void {
  useGeneratorStore.setState({
    tab: 'references',
    presetId: 'seedance-2.5',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })
}

beforeEach(() => {
  mocks.captureGenerationFrame.mockReset()
  mocks.linkGenerationFile.mockReset()
  resetGenerator()
})

describe('applyRecordToGenerator', () => {
  it('captures the last frame on the frames tab', async () => {
    const frame = upload('frame', 'image')

    mocks.captureGenerationFrame.mockResolvedValue(frame)
    useGeneratorStore.setState({ tab: 'frames' })

    const isApplied = await applyRecordToGenerator(record('history-record'))

    expect(isApplied).toBe(true)
    expect(mocks.captureGenerationFrame).toHaveBeenCalledWith('history-record', 'last')
    expect(mocks.linkGenerationFile).not.toHaveBeenCalled()
    expect(useGeneratorStore.getState().frames.start).toBe(frame.id)
  })

  it('links the video as a reference on the references tab', async () => {
    const linked = upload('linked', 'video')

    mocks.linkGenerationFile.mockResolvedValue(linked)

    const isApplied = await applyRecordToGenerator(record('history-record'))

    expect(isApplied).toBe(true)
    expect(mocks.linkGenerationFile).toHaveBeenCalledWith({ generationId: 'history-record' })
    expect(mocks.captureGenerationFrame).not.toHaveBeenCalled()
    expect(useGeneratorStore.getState().references).toEqual([linked.id])
    expect(useGeneratorStore.getState().tab).toBe('references')
  })
})
