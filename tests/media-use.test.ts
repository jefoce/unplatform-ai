// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { UploadItem } from '@/core/schemas/upload-item'
import {
  type MediaTarget,
  type MediaUse,
  mediaUse,
  type MediaUseState,
} from '@/features/generator/use-media'
import type { PreviewItem } from '@/features/preview/preview-store'

import { record as makeRecord } from './helpers/history'
import { upload } from './helpers/validation-fixtures'

interface PresetsModule {
  getPreset: (id: string) => ModelPreset
}

const mocks = vi.hoisted(() => {
  return { presets: new Map<string, ModelPreset>() }
})

vi.mock('@/core/presets', async (importOriginal) => {
  const actual = await importOriginal<PresetsModule>()

  return {
    ...actual,
    getPreset: (id: string) => {
      return mocks.presets.get(id) ?? actual.getPreset(id)
    },
  }
})

const BASE = getPreset('seedance-2.5')

mocks.presets.set('no-video', {
  ...BASE,
  references: { ...BASE.references, video: 0 },
})

mocks.presets.set('no-image', {
  ...BASE,
  references: { ...BASE.references, image: 0 },
})

mocks.presets.set('no-start', {
  ...BASE,
  frames: { ...BASE.frames, start: false },
})

mocks.presets.set('one-image', {
  ...BASE,
  references: { ...BASE.references, image: 1 },
})

function state(overrides: Partial<MediaUseState> = {}): MediaUseState {
  return {
    tab: 'references',
    presetId: 'seedance-2.5',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
    ...overrides,
  }
}

function uploads(...items: UploadItem[]): Record<string, UploadItem> {
  return Object.fromEntries(
    items.map((item) => {
      return [item.id, item]
    }),
  )
}

const imageOne = upload('image-1', 'image')
const imageTwo = upload('image-2', 'image')
const imageThree = upload('image-3', 'image')
const audio = upload('audio-1', 'audio')
const recordTarget: MediaTarget = { kind: 'record', record: makeRecord('history-record') }

const FOLDER_PATH = '/photos'

const folderPreview: PreviewItem = {
  ...upload('folder:7:clip.png', 'image'),
  previewRef: 'folders/7/clip.png',
  folderPath: FOLDER_PATH,
}

const folderLinked = upload('linked-folder', 'image', { target: `${FOLDER_PATH}/clip.png` })

const videoRefs = Array.from({ length: 10 }, (_, index) => {
  return upload(`video-${index}`, 'video')
})

interface UseCase {
  name: string
  target: MediaTarget
  state: MediaUseState
  expected: MediaUse
}

const cases: UseCase[] = [
  {
    name: 'references record enabled',
    target: recordTarget,
    state: state(),
    expected: { label: 'Reference', isDisabled: false, reason: 'Reference' },
  },
  {
    name: 'references record with no video references',
    target: recordTarget,
    state: state({ presetId: 'no-video' }),
    expected: {
      label: 'Reference',
      isDisabled: true,
      reason: 'This model does not take video references',
    },
  },
  {
    name: 'references record at the video limit',
    target: recordTarget,
    state: state({
      references: videoRefs.map((item) => {
        return item.id
      }),
      uploadsById: uploads(...videoRefs),
    }),
    expected: { label: 'Reference', isDisabled: true, reason: 'Reference limit reached' },
  },
  {
    name: 'references image upload enabled',
    target: { kind: 'upload', upload: imageOne },
    state: state(),
    expected: { label: 'Reference', isDisabled: false, reason: 'Reference' },
  },
  {
    name: 'references audio upload enabled',
    target: { kind: 'upload', upload: audio },
    state: state(),
    expected: { label: 'Reference', isDisabled: false, reason: 'Reference' },
  },
  {
    name: 'references upload of a kind with zero slots',
    target: { kind: 'upload', upload: imageOne },
    state: state({ presetId: 'no-image' }),
    expected: {
      label: 'Reference',
      isDisabled: true,
      reason: 'This model does not take image references',
    },
  },
  {
    name: 'references upload already attached',
    target: { kind: 'upload', upload: imageTwo },
    state: state({
      references: [imageOne.id, imageTwo.id],
      uploadsById: uploads(imageOne, imageTwo),
    }),
    expected: { label: 'Reference', isDisabled: true, reason: 'Already @Image 2' },
  },
  {
    name: 'references upload already attached without a loaded slot',
    target: { kind: 'upload', upload: imageThree },
    state: state({ references: [imageThree.id] }),
    expected: { label: 'Reference', isDisabled: true, reason: 'Reference' },
  },
  {
    name: 'references upload at the image limit',
    target: { kind: 'upload', upload: imageTwo },
    state: state({
      presetId: 'one-image',
      references: [imageOne.id],
      uploadsById: uploads(imageOne),
    }),
    expected: { label: 'Reference', isDisabled: true, reason: 'Reference limit reached' },
  },
  {
    name: 'references folder preview already attached',
    target: { kind: 'upload', upload: folderPreview },
    state: state({
      references: [folderLinked.id],
      uploadsById: uploads(folderLinked),
    }),
    expected: { label: 'Reference', isDisabled: true, reason: 'Already @Image 1' },
  },
  {
    name: 'references folder preview not attached',
    target: { kind: 'upload', upload: folderPreview },
    state: state({ uploadsById: uploads(folderLinked) }),
    expected: { label: 'Reference', isDisabled: false, reason: 'Reference' },
  },
  {
    name: 'frames folder preview linked to the start frame',
    target: { kind: 'upload', upload: folderPreview },
    state: state({
      tab: 'frames',
      frames: { start: folderLinked.id, end: null },
      uploadsById: uploads(folderLinked),
    }),
    expected: { label: 'Start frame', isDisabled: true, reason: 'Already the start frame' },
  },
  {
    name: 'frames record enabled',
    target: recordTarget,
    state: state({ tab: 'frames' }),
    expected: { label: 'Start frame', isDisabled: false, reason: 'Start frame' },
  },
  {
    name: 'frames record with no start frame slot',
    target: recordTarget,
    state: state({ tab: 'frames', presetId: 'no-start' }),
    expected: {
      label: 'Start frame',
      isDisabled: true,
      reason: 'This model does not take a start frame',
    },
  },
  {
    name: 'frames image upload enabled',
    target: { kind: 'upload', upload: imageOne },
    state: state({ tab: 'frames' }),
    expected: { label: 'Start frame', isDisabled: false, reason: 'Start frame' },
  },
  {
    name: 'frames video upload',
    target: { kind: 'upload', upload: upload('clip', 'video') },
    state: state({ tab: 'frames' }),
    expected: { label: 'Start frame', isDisabled: true, reason: 'Start frame takes an image' },
  },
  {
    name: 'frames audio upload',
    target: { kind: 'upload', upload: audio },
    state: state({ tab: 'frames' }),
    expected: { label: 'Start frame', isDisabled: true, reason: 'Start frame takes an image' },
  },
  {
    name: 'frames upload already the start frame',
    target: { kind: 'upload', upload: imageOne },
    state: state({ tab: 'frames', frames: { start: imageOne.id, end: null } }),
    expected: { label: 'Start frame', isDisabled: true, reason: 'Already the start frame' },
  },
  {
    name: 'frames upload with no start frame slot',
    target: { kind: 'upload', upload: imageOne },
    state: state({ tab: 'frames', presetId: 'no-start' }),
    expected: {
      label: 'Start frame',
      isDisabled: true,
      reason: 'This model does not take a start frame',
    },
  },
]

describe('mediaUse', () => {
  it.each(cases)('$name', ({ target, state: mediaState, expected }) => {
    expect(mediaUse(target, mediaState)).toEqual(expected)
  })
})
