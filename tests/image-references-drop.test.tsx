// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { noop } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ImageReferences } from '@/features/image-generator/ImageReferences'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { routeFiles } from '@/features/media-input/route-files'
import { useWindowFileInput } from '@/features/media-input/use-window-file-input'
import { getPlatform } from '@/lib/platform'

import { mockPlatform } from './helpers/platform-mock'
import { required } from './helpers/required'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return { uploadFiles: vi.fn(), uploadFilesWithProgress: vi.fn() }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    uploadFiles: mocks.uploadFiles,
    uploadFilesWithProgress: mocks.uploadFilesWithProgress,
  }
})

vi.mock('@/lib/platform', () => {
  return { getPlatform: vi.fn() }
})

const png = new File(['png'], 'a.png', { type: 'image/png' })
const existing = upload('image-existing', 'image')
const added = upload('image-added', 'image')

function handleFiles(files: File[]): void {
  void routeFiles(files)
}

function Harness() {
  useWindowFileInput({ onFiles: handleFiles, onPaths: noop, workspace: 'image' })

  return <ImageReferences />
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlatform).mockResolvedValue(mockPlatform)
  mocks.uploadFiles.mockResolvedValue([added])
  window.history.replaceState(null, '', '/?tab=image')

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    references: [existing.id],
    uploadsById: uploadsOf(existing),
  })
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('image reference drop', () => {
  it('uploads one file once and adds one reference for one drop', async () => {
    render(<Harness />)

    const row = required(document.querySelector<HTMLElement>('[data-image-references]'), 'row')

    await act(async () => {
      fireEvent.drop(row, { dataTransfer: { files: [png], types: ['Files'] } })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().references).toEqual([existing.id, added.id])
    })

    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1)
    expect(mocks.uploadFilesWithProgress).not.toHaveBeenCalled()
  })
})
