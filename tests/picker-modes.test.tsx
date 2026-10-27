// @vitest-environment jsdom
import { type ReactNode, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerCandidate,
  type PickerPickMode,
  type PickerToggleMode,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { UploadsTab } from '@/features/media-picker/uploads/UploadsTab'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview } from '@/features/preview/preview-store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchUploads: vi.fn(),
    items: [] as UploadItem[],
  }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    fetchUploads: mocks.fetchUploads,
    deleteUpload: vi.fn(),
  }
})

const items = [upload('a', 'image'), upload('b', 'image')]

vi.mock('swr', () => {
  return {
    default: () => {
      return {
        data: mocks.items,
        isLoading: false,
        mutate: vi.fn(),
      }
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  mocks.items = items

  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => {
      return Promise.resolve()
    },
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closeMediaPicker()
  closePreview()
  vi.unstubAllGlobals()
})

function toggleMode(params: {
  selectedIds: string[]
  canAdd: (item: PickerCandidate) => string | null
  onToggle: (item: UploadItem) => void
}): PickerToggleMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return params.selectedIds
    },
    useUploadsById: () => {
      return uploadsOf(...items)
    },
    canAdd: params.canAdd,
    onToggle: params.onToggle,
    onAdd: vi.fn(),
  }
}

function renderToolbar(): ReactNode {
  return <span>Use media</span>
}

interface ToggleHarnessProps {
  onToggle: (item: UploadItem) => void
}

/** Toggle mode backed by real state so the preview footer reads live selection. */
function ToggleHarness(props: ToggleHarnessProps) {
  const [selected, setSelected] = useState<UploadItem[]>([])

  const handleToggle = (item: UploadItem) => {
    props.onToggle(item)

    setSelected((previous) => {
      const isAttached = previous.some((each) => {
        return each.id === item.id
      })

      if (isAttached) {
        return previous.filter((each) => {
          return each.id !== item.id
        })
      }

      return [...previous, item]
    })
  }

  const mode: PickerToggleMode = {
    kind: 'toggle',
    useSelectedIds: () => {
      return selected.map((item) => {
        return item.id
      })
    },
    useUploadsById: () => {
      return uploadsOf(...selected)
    },
    canAdd: () => {
      return null
    },
    onToggle: handleToggle,
    onAdd: vi.fn(),
  }

  return (
    <>
      <UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />
      <MediaPreviewModal toolbar={renderToolbar} />
    </>
  )
}

describe('picker request modes', () => {
  it('toggles an upload click and shows the store selection', () => {
    const onToggle = vi.fn<(item: UploadItem) => void>()

    const mode = toggleMode({
      selectedIds: ['a'],
      canAdd: () => {
        return null
      },
      onToggle,
    })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    const selected = screen.getByRole('button', { name: 'a.png' })
    const other = screen.getByRole('button', { name: 'b.png' })

    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(other.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(other)

    expect(onToggle).toHaveBeenCalledWith(items[1])
  })

  it('shows the same linked upload as selected in the Uploads tab', () => {
    const linked = upload('linked', 'image', {
      source: 'link',
      target: '/videos/root/clip.png',
    })

    mocks.items = [linked]

    const mode = toggleMode({
      selectedIds: ['linked'],
      canAdd: () => {
        return null
      },
      onToggle: vi.fn<(item: UploadItem) => void>(),
    })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'linked.png' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('disables an unselected upload and shows the reason', async () => {
    const mode = toggleMode({
      selectedIds: [],
      canAdd: () => {
        return 'Reference limit reached'
      },
      onToggle: vi.fn<(item: UploadItem) => void>(),
    })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    const tile = screen.getByRole('button', { name: 'a.png' })

    expect((tile as HTMLButtonElement).disabled).toBe(true)

    fireEvent.focus(tile)

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe('Reference limit reached')
  })

  it('picks an upload and closes the picker in pick mode', () => {
    const onPick = vi.fn<(item: UploadItem) => void>()
    const mode: PickerPickMode = { kind: 'pick', onPick }

    openMediaPicker({ openerKey: 'test', kinds: ['image'], mode })

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))

    expect(onPick).toHaveBeenCalledWith(items[0])
    expect(useMediaPickerStore.getState().request).toBeNull()
  })

  it('toggles from the picker preview, keeps it open and hides the Use button', async () => {
    const onToggle = vi.fn<(item: UploadItem) => void>()

    render(<ToggleHarness onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('button', { name: 'Preview a.png' }))

    expect(screen.queryByText('Use media')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deselect' })).toBeTruthy()
    })

    expect(onToggle).toHaveBeenCalledWith(items[0])
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps the supplied anchor on the request', () => {
    const anchor = document.createElement('button')
    const mode: PickerPickMode = { kind: 'pick', onPick: vi.fn() }

    openMediaPicker({ openerKey: 'test', kinds: ['image'], mode, anchor })

    expect(useMediaPickerStore.getState().request?.anchor).toBe(anchor)
  })
})

describe('picker tile clicks', () => {
  it('removes an attached upload when its tile is clicked', () => {
    const onToggle = vi.fn<(item: UploadItem) => void>()

    render(<ToggleHarness onToggle={onToggle} />)

    const tile = screen.getByRole('button', { name: 'a.png' })

    fireEvent.click(tile)

    expect(tile.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(tile)

    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(onToggle).toHaveBeenLastCalledWith(items[0])
    expect(tile.getAttribute('aria-pressed')).toBe('false')
  })
})
