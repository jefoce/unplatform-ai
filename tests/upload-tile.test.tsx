// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UploadTile } from '@/features/media-picker/uploads/UploadTile'

import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return { uploadFilesWithProgress: vi.fn(), linkAbsPath: vi.fn() }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    uploadFilesWithProgress: mocks.uploadFilesWithProgress,
    linkAbsPath: mocks.linkAbsPath,
  }
})

const png = new File(['png'], 'browser.png', { type: 'image/png' })
const added = upload('browser-added', 'image')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.uploadFilesWithProgress.mockResolvedValue([added])
})

afterEach(() => {
  cleanup()
})

describe('UploadTile browser copy', () => {
  it('uploads the hidden input files and never links a path', async () => {
    const onUploaded = vi.fn()

    render(<UploadTile kinds={['image']} max={1} onUploaded={onUploaded} />)

    fireEvent.change(screen.getByLabelText('Upload file'), { target: { files: [png] } })

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith([added])
    })

    expect(mocks.uploadFilesWithProgress).toHaveBeenCalledTimes(1)

    expect(mocks.uploadFilesWithProgress).toHaveBeenCalledWith({
      files: [png],
      onProgress: expect.any(Function),
    })

    expect(mocks.linkAbsPath).not.toHaveBeenCalled()
  })
})
