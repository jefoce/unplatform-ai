// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { ImagePromptBar } from '@/features/image-generator/ImagePromptBar'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { upload } from './helpers/validation-fixtures'

vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
  }
})

const toastMock = vi.hoisted(() => {
  return { toast: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: toastMock.toast }
})

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return { isKeyMissing: false, isReady: true, reason: null }
    },
  }
})

vi.mock('@/features/image-generator/use-image-estimate', () => {
  return {
    useImageEstimate: () => {
      return { usd: null, isApproximate: false, isLoading: false }
    },
  }
})

vi.mock('@/features/image-generator/use-image-submit', () => {
  return {
    useImageSubmit: () => {
      return { submit: vi.fn(), isSubmitting: false }
    },
  }
})

vi.mock('@/features/generator/model/ModelPicker', () => {
  return {
    ModelPicker: () => {
      return null
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const first = upload('image-first', 'image')
const second = upload('image-second', 'image')

let serverUploads: UploadItem[] = []

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input)

  if (!url.startsWith('/api/uploads')) {
    throw new Error(`Unexpected fetch: ${url}`)
  }

  return Promise.resolve(new Response(JSON.stringify(serverUploads), { status: 200 }))
})

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  Range.prototype.getBoundingClientRect = () => {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
  }

  Range.prototype.getClientRects = () => {
    return {
      length: 0,
      item: () => {
        return null
      },
    } as unknown as DOMRectList
  }

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })

  vi.stubGlobal('fetch', fetchMock)

  toastMock.toast.mockReset()
  fetchMock.mockClear()
  serverUploads = [first, second]

  useImageGeneratorStore.setState({
    presetId: 'gemini-3.1-flash-image',
    prompt: 'a cat',
    references: [first.id, second.id],
    uploadsById: {},
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('image references after reload', () => {
  it('shows a skeleton until the uploads fetch resolves', async () => {
    let resolveUploads: (() => void) | undefined

    fetchMock.mockImplementationOnce(() => {
      return new Promise<Response>((resolve) => {
        resolveUploads = () => {
          resolve(new Response(JSON.stringify(serverUploads), { status: 200 }))
        }
      })
    })

    render(<ImagePromptBar activeCount={0} />)

    expect(document.querySelector('[data-reference-skeleton]')).not.toBeNull()
    expect(screen.queryByAltText(first.originalName)).toBeNull()

    act(() => {
      resolveUploads?.()
    })

    expect(await screen.findByAltText(first.originalName)).not.toBeNull()
    expect(document.querySelector('[data-reference-skeleton]')).toBeNull()
  })

  it('restores both reference thumbnails from the uploads fetch', async () => {
    render(<ImagePromptBar activeCount={0} />)

    const firstThumb = await screen.findByAltText(first.originalName)
    const secondThumb = await screen.findByAltText(second.originalName)

    expect(firstThumb.getAttribute('src')).toContain(`/api/thumbs/uploads/${first.id}`)
    expect(secondThumb.getAttribute('src')).toContain(`/api/thumbs/uploads/${second.id}`)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('drops a reference the server no longer has and toasts', async () => {
    serverUploads = [first]

    render(<ImagePromptBar activeCount={0} />)

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().references).toEqual([first.id])
    })

    expect(await screen.findByAltText(first.originalName)).toBeTruthy()

    const removeButtons = document.querySelectorAll(
      '[data-image-references] [aria-label^="Remove "]',
    )

    expect(removeButtons).toHaveLength(1)
    expect(toastMock.toast).toHaveBeenCalledWith('Reference removed')
  })
})
