// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import {
  type PasteMediaOptions,
  usePasteMedia,
} from '@/features/media-picker/uploads/use-paste-media'
import { linkAbsPath } from '@/lib/api/uploads'

const toast = vi.hoisted(() => {
  return { error: vi.fn(), skipped: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: Object.assign(toast.skipped, { error: toast.error }) }
})

vi.mock('@/lib/api/uploads', () => {
  return { linkAbsPath: vi.fn() }
})

const png = new File(['png'], 'a.png', { type: 'image/png' })
const gif = new File(['gif'], 'b.gif', { type: 'image/gif' })

const video: UploadItem = {
  id: 'v1',
  source: 'link',
  kind: 'video',
  mime: 'video/mp4',
  ext: 'mp4',
  originalName: 'clip.mp4',
  sizeBytes: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
}

type Options = Pick<PasteMediaOptions, 'kinds' | 'onFiles' | 'onUploaded'> &
  Partial<Pick<PasteMediaOptions, 'enabled'>>

function clipboard(files: File[] = [], text = '') {
  return {
    files,
    getData: () => {
      return text
    },
  }
}

function Harness({ options }: { options: Options }) {
  const { onPaste: handlePaste } = usePasteMedia({
    enabled: true,
    scope: 'element',
    ...options,
  })

  return (
    <div data-testid="surface" onPaste={handlePaste}>
      <input aria-label="text" />
      <div data-testid="editor" data-prompt-editor contentEditable suppressContentEditableWarning />
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('usePasteMedia', () => {
  it('uploads accepted files and reports skipped ones', () => {
    const onFiles = vi.fn()

    const view = render(
      <Harness
        options={{
          kinds: () => {
            return ['image']
          },
          onFiles,
          onUploaded: vi.fn(),
        }}
      />,
    )

    const isHandled = fireEvent.paste(view.getByTestId('surface'), {
      clipboardData: clipboard([png, gif]),
    })

    expect(isHandled).toBe(false)
    expect(onFiles).toHaveBeenCalledWith([png])
    expect(toast.skipped).toHaveBeenCalledWith('Skipped 1 unsupported file')
  })

  it('links an absolute media path pasted as text', async () => {
    vi.mocked(linkAbsPath).mockResolvedValue(video)
    const onUploaded = vi.fn()

    const view = render(
      <Harness
        options={{
          kinds: () => {
            return ['video']
          },
          onFiles: vi.fn(),
          onUploaded,
        }}
      />,
    )

    fireEvent.paste(view.getByTestId('surface'), {
      clipboardData: clipboard([], '  "/tmp/clip.mp4"  '),
    })

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith([video])
    })

    expect(linkAbsPath).toHaveBeenCalledWith('/tmp/clip.mp4')
  })
})

describe('usePasteMedia editor', () => {
  it('ignores a paste inside a text input', () => {
    const onFiles = vi.fn()

    const view = render(
      <Harness
        options={{
          kinds: () => {
            return ['image']
          },
          onFiles,
          onUploaded: vi.fn(),
        }}
      />,
    )

    fireEvent.paste(view.getByLabelText('text'), {
      clipboardData: clipboard([png], '/tmp/a.png'),
    })

    expect(onFiles).not.toHaveBeenCalled()
    expect(linkAbsPath).not.toHaveBeenCalled()
  })

  it('ignores text pasted into the prompt editor', () => {
    const onFiles = vi.fn()

    const view = render(
      <Harness
        options={{
          kinds: () => {
            return ['image']
          },
          onFiles,
          onUploaded: vi.fn(),
        }}
      />,
    )

    fireEvent.paste(view.getByTestId('editor'), {
      clipboardData: clipboard([], '/tmp/a.png'),
    })

    expect(onFiles).not.toHaveBeenCalled()
    expect(linkAbsPath).not.toHaveBeenCalled()
  })

  it('handles files pasted into the prompt editor', () => {
    const onFiles = vi.fn()

    const view = render(
      <Harness
        options={{
          kinds: () => {
            return ['image']
          },
          onFiles,
          onUploaded: vi.fn(),
        }}
      />,
    )

    const isHandled = fireEvent.paste(view.getByTestId('editor'), {
      clipboardData: clipboard([png]),
    })

    expect(isHandled).toBe(false)
    expect(onFiles).toHaveBeenCalledWith([png])
  })
})
