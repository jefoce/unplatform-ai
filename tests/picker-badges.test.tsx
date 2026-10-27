// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { folderTargetPath } from '@/core/folder-match'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import { FolderTab } from '@/features/media-picker/folders/FolderTab'
import type { PickerPickMode, PickerToggleMode } from '@/features/media-picker/picker/store'
import { UploadsTab } from '@/features/media-picker/uploads/UploadsTab'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchUploads: vi.fn(),
    data: null as unknown[] | Record<string, unknown> | null,
  }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    fetchUploads: mocks.fetchUploads,
    deleteUpload: vi.fn(),
    linkFolderFile: vi.fn(),
  }
})

vi.mock('@/lib/api/folders', () => {
  return {
    fetchFolderFiles: vi.fn(),
    linkFolderFile: vi.fn(),
  }
})

vi.mock('@/lib/api/media-urls', () => {
  return {
    thumbUrl: () => {
      return '/thumb'
    },
    mediaUrl: () => {
      return '/media'
    },
  }
})

vi.mock('swr', () => {
  return {
    default: () => {
      return { data: mocks.data, isLoading: false, mutate: vi.fn() }
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  mocks.data = null
  mocks.fetchUploads.mockReset()
  vi.unstubAllGlobals()
})

interface ReferenceHarnessProps {
  items: UploadItem[]
  kinds: MediaKind[]
}

/** Toggle mode backed by real state so badges follow the attach order live. */
function ReferenceHarness(props: ReferenceHarnessProps) {
  const [selected, setSelected] = useState<UploadItem[]>([])
  const uploadsById: UploadsById = uploadsOf(...props.items)

  const handleToggle = (item: UploadItem) => {
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
      return uploadsById
    },
    canAdd: () => {
      return null
    },
    onToggle: handleToggle,
    onAdd: vi.fn(),
  }

  return <UploadsTab kinds={props.kinds} mode={mode} onUploaded={vi.fn()} />
}

function tileRoot(name: string): HTMLElement {
  const root = screen.getByRole('button', { name }).parentElement

  if (isNil(root)) {
    throw new Error(`Missing tile ${name}`)
  }

  return root
}

function badgeOf(name: string): string | null {
  return within(tileRoot(name)).queryByText(/^\d+$/)?.textContent ?? null
}

const FOLDER_PATH = '/videos/root'

describe('picker slot badges', () => {
  it('numbers three selected image references in attach order', () => {
    const items = [upload('a', 'image'), upload('b', 'image'), upload('c', 'image')]

    mocks.data = items

    render(<ReferenceHarness items={items} kinds={['image']} />)

    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'b.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'c.png' }))

    expect(badgeOf('a.png')).toBe('1')
    expect(badgeOf('b.png')).toBe('2')
    expect(badgeOf('c.png')).toBe('3')
  })

  it('renumbers the remaining references after the first is removed', () => {
    const items = [upload('a', 'image'), upload('b', 'image'), upload('c', 'image')]

    mocks.data = items

    render(<ReferenceHarness items={items} kinds={['image']} />)

    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'b.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'c.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))

    expect(badgeOf('a.png')).toBeNull()
    expect(badgeOf('b.png')).toBe('1')
    expect(badgeOf('c.png')).toBe('2')
  })

  it('numbers one image and one video as slot 1 for each kind', () => {
    const items = [upload('a', 'image'), upload('clip', 'video')]

    mocks.data = items

    render(<ReferenceHarness items={items} kinds={['image', 'video']} />)

    fireEvent.click(screen.getByRole('button', { name: 'a.png' }))
    fireEvent.click(screen.getByRole('button', { name: 'clip.mp4' }))

    expect(badgeOf('a.png')).toBe('1')
    expect(badgeOf('clip.mp4')).toBe('1')
  })

  it('shows a folder file attached at video slot 2 as badge 2', () => {
    const earlier = upload('video-1', 'video')

    const linked = upload('video-2', 'video', {
      source: 'link',
      target: folderTargetPath({ folderPath: FOLDER_PATH, rel: 'clip.mp4' }),
    })

    mocks.data = {
      path: '',
      dirs: [],
      files: [{ name: 'clip.mp4', rel: 'clip.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 }],
    }

    const mode: PickerToggleMode = {
      kind: 'toggle',
      useSelectedIds: () => {
        return ['video-1', 'video-2']
      },
      useUploadsById: () => {
        return uploadsOf(earlier, linked)
      },
      canAdd: () => {
        return null
      },
      onToggle: vi.fn(),
      onAdd: vi.fn(),
    }

    render(
      <FolderTab
        folderId="folder-1"
        folderPath={FOLDER_PATH}
        folderName="Folder"
        kinds={['video']}
        sub=""
        mode={mode}
        onNavigate={vi.fn()}
      />,
    )

    expect(badgeOf('Select clip.mp4')).toBe('2')
  })

  it('shows no slot number in pick mode', () => {
    const mode: PickerPickMode = { kind: 'pick', onPick: vi.fn() }

    mocks.data = [upload('a', 'image')]

    render(<UploadsTab kinds={['image']} mode={mode} onUploaded={vi.fn()} />)

    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })
})
