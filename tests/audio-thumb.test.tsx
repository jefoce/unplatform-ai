// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FolderFile } from '@/core/api/folders'
import { PromptMentionsProvider } from '@/features/generator/prompt/PromptMentionsProvider'
import { ReferenceThumb } from '@/features/generator/references/ReferenceThumb'
import { InputThumb } from '@/features/history/details/InputThumb'
import { PromptSlot } from '@/features/history/details/PromptSlot'
import type { ThumbItem } from '@/features/history/details/thumb-item'
import { FolderFileTile } from '@/features/media-picker/folders/FolderFileTile'
import type * as MediaUrls from '@/lib/api/media-urls'
import type * as AudioPlayer from '@/lib/audio-player'

import { Observer } from './helpers/history'
import { upload } from './helpers/validation-fixtures'

vi.stubGlobal('matchMedia', () => {
  return { addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() }
})

const { ReferenceChip } = await import('@/features/generator/references/ReferenceChip')

const mocks = vi.hoisted(() => {
  return {
    uploadThumbUrl: vi.fn((id: string) => {
      return `/thumb/uploads/${id}`
    }),
    thumbUrl: vi.fn(() => {
      return '/thumb'
    }),
    mediaUrl: vi.fn(() => {
      return '/media'
    }),
    playAudio: vi.fn(),
    pauseAudio: vi.fn(),
  }
})

vi.mock('@/lib/api/media-urls', async (importOriginal) => {
  const actual = await importOriginal<typeof MediaUrls>()

  return {
    ...actual,
    uploadThumbUrl: mocks.uploadThumbUrl,
    thumbUrl: mocks.thumbUrl,
    mediaUrl: mocks.mediaUrl,
  }
})

vi.mock('@/lib/audio-player', async (importOriginal) => {
  const actual = await importOriginal<typeof AudioPlayer>()

  return {
    ...actual,
    playAudio: mocks.playAudio,
    pauseAudio: mocks.pauseAudio,
    useAudioPlaying: () => {
      return false
    },
    useAudioTime: () => {
      return null
    },
  }
})

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const AUDIO_FILE: FolderFile = {
  name: 'song.mp3',
  rel: 'song.mp3',
  kind: 'audio',
  sizeBytes: 1,
  mtimeMs: 1,
}

function folderTile() {
  return render(
    <FolderFileTile
      file={AUDIO_FILE}
      src="/thumb"
      audioSrc="/media/song"
      isBroken={false}
      isSelected={false}
      isDisabled={false}
      isBusy={false}
      onSelect={vi.fn()}
      onExpand={vi.fn()}
      onBroken={vi.fn()}
    />,
  )
}

interface ThumbOverrides {
  id?: string
  kind?: ThumbItem['kind']
  name?: string
  missing?: boolean
}

function thumbItem(overrides: ThumbOverrides = {}): ThumbItem {
  return {
    id: 'ref-1',
    kind: 'image',
    label: 'Reference',
    name: 'ref.png',
    missing: false,
    ...overrides,
  }
}

function renderInputThumb(item: ThumbItem) {
  return render(<InputThumb item={item} items={[item]} index={0} />)
}

describe('folder audio tile', () => {
  it('renders the wave bars and the name', () => {
    const { container } = folderTile()

    expect(screen.getByText('song.mp3')).toBeTruthy()
    expect(container.querySelectorAll('span[style*="height"]').length).toBe(36)
  })

  it('plays the audio from the play button', () => {
    folderTile()

    fireEvent.click(screen.getByRole('button', { name: 'Play song.mp3' }))

    expect(mocks.playAudio).toHaveBeenCalledWith('/media/song')
  })
})

describe('input thumb audio', () => {
  it('renders the wave and skips the thumb request', () => {
    const { container } = renderInputThumb(
      thumbItem({ id: 'audio-1', kind: 'audio', name: 'song.mp3' }),
    )

    expect(container.querySelector('[data-audio-thumb]')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.uploadThumbUrl).not.toHaveBeenCalled()
  })

  it('renders the initial badge for a missing audio input without a request', () => {
    const { container } = renderInputThumb(
      thumbItem({ id: 'gone', kind: 'audio', name: 'gone.mp3', missing: true }),
    )

    expect(screen.getByText('G')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.uploadThumbUrl).not.toHaveBeenCalled()
  })

  it('renders the initial badge for a missing video input without a request', () => {
    const { container } = renderInputThumb(
      thumbItem({ id: 'gone', kind: 'video', name: 'gone.mp4', missing: true }),
    )

    expect(screen.getByText('G')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.uploadThumbUrl).not.toHaveBeenCalled()
  })

  it('still requests the poster for a video input', () => {
    const { container } = renderInputThumb(
      thumbItem({ id: 'video-1', kind: 'video', name: 'clip.mp4' }),
    )

    expect(container.querySelector('img')).not.toBeNull()
    expect(mocks.uploadThumbUrl).toHaveBeenCalledWith('video-1')
  })
})

const AUDIO_SLOT = { kind: 'audio', n: 1 } as const

const AUDIO_SNAPSHOT = {
  'audio-1': { kind: 'audio', originalName: 'song.mp3', source: 'file' },
} as const

describe('reference audio thumbs', () => {
  it('renders a prompt slot without a thumb request', () => {
    render(
      <PromptSlot
        slot={AUDIO_SLOT}
        slots={new Map([['audio-1', AUDIO_SLOT]])}
        snapshot={AUDIO_SNAPSHOT}
      />,
    )

    expect(mocks.uploadThumbUrl).not.toHaveBeenCalled()
  })

  it('renders a reference chip without a thumb request', () => {
    const item = upload('audio-1', 'audio')

    render(
      <PromptMentionsProvider
        mentions={{ references: ['audio-1'], uploadsById: { 'audio-1': item } }}
      >
        <ReferenceChip
          trigger="@"
          value="Audio 1"
          data={{ kind: 'audio', n: 1 }}
          data-beautiful-mention="@Audio 1"
        />
      </PromptMentionsProvider>,
    )

    expect(mocks.thumbUrl).not.toHaveBeenCalled()
  })

  it('renders a reference thumb without a thumb request', () => {
    const { container } = render(
      <ReferenceThumb upload={upload('audio-1', 'audio')} label="Audio 1" onRemove={vi.fn()} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(mocks.thumbUrl).not.toHaveBeenCalled()
    expect(mocks.mediaUrl).toHaveBeenCalled()
  })
})
