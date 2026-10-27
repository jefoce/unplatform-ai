// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReferencesBox } from '@/features/generator/references/ReferencesBox'
import { useGeneratorStore } from '@/features/generator/store/store'
import { pickerAnchor } from '@/features/media-picker/picker/anchors'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerPickMode,
  type PickerRequest,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return { useMediaQuery: vi.fn() }
})

vi.mock('@/lib/use-media-query', () => {
  return { useMediaQuery: mocks.useMediaQuery }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function pickMode(): PickerPickMode {
  return { kind: 'pick', onPick: vi.fn() }
}

function currentRequest(): PickerRequest | null {
  return useMediaPickerStore.getState().request
}

beforeEach(() => {
  mocks.useMediaQuery.mockReturnValue(true)
  vi.stubGlobal('ResizeObserver', Observer)

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    references: [],
    uploadsById: {},
    frames: { start: null, end: null },
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closeMediaPicker()
  closePreview()
  mocks.useMediaQuery.mockReset()
  vi.unstubAllGlobals()
})

describe('picker request reuse', () => {
  it('keeps the first id, opener, items, mode and anchor when the same opener opens it', () => {
    const anchor = document.createElement('div')
    const mode = pickMode()

    openMediaPicker({ openerKey: 'test:add', kinds: ['image'], mode, anchor })

    const first = currentRequest()

    openMediaPicker({
      openerKey: 'test:add',
      kinds: ['video', 'audio'],
      mode: pickMode(),
      anchor: document.createElement('button'),
    })

    const current = currentRequest()

    expect(current?.id).toBe(first?.id)
    expect(current?.openerKey).toBe('test:add')
    expect(current?.kinds).toEqual(['image'])
    expect(current?.mode).toBe(mode)
    expect(current?.anchor).toBe(anchor)
  })

  it('replaces the request when a different opener opens it', () => {
    const firstMode = pickMode()
    const nextMode = pickMode()

    openMediaPicker({ openerKey: 'test:add', kinds: ['image'], mode: firstMode })

    const firstId = currentRequest()?.id

    openMediaPicker({ openerKey: 'test:replace', kinds: ['video'], mode: nextMode })

    const current = currentRequest()

    expect(current?.id).not.toBe(firstId)
    expect(current?.openerKey).toBe('test:replace')
    expect(current?.kinds).toEqual(['video'])
    expect(current?.mode).toBe(nextMode)
  })

  it('creates a new request after the picker closes', () => {
    openMediaPicker({ openerKey: 'test:add', kinds: ['image'], mode: pickMode() })

    const firstId = currentRequest()?.id

    closeMediaPicker()
    openMediaPicker({ openerKey: 'test:add', kinds: ['image'], mode: pickMode() })

    expect(currentRequest()?.id).not.toBe(firstId)
  })
})

describe('picker opener keys', () => {
  it('keeps the id, opener, mode and rendered body when the add control is clicked again', async () => {
    render(
      <>
        <ReferencesBox />
        <MediaPicker />
      </>,
    )

    const add = screen.getByRole('button', { name: /^Add references/ })

    fireEvent.click(add)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    const body = screen.getByRole('button', { name: 'Uploads' })
    const first = currentRequest()

    fireEvent.click(add)

    const current = currentRequest()

    expect(current?.id).toBe(first?.id)
    expect(current?.openerKey).toBe('references:add')
    expect(current?.mode).toBe(first?.mode)
    expect(screen.getByRole('button', { name: 'Uploads' })).toBe(body)
  })

  it('replaces a reference with a pick request anchored to the references box', () => {
    const image = upload('image-1', 'image')

    useGeneratorStore.setState({ references: [image.id], uploadsById: uploadsOf(image) })

    render(<ReferencesBox />)

    fireEvent.click(screen.getByRole('button', { name: 'Add references' }))

    const addRequest = currentRequest()
    const anchor = addRequest?.anchor

    fireEvent.click(screen.getByRole('button', { name: /^Preview / }))

    const replace = usePreviewStore.getState().request?.actions?.replace

    act(() => {
      replace?.(image)
    })

    const current = currentRequest()

    expect(current?.id).not.toBe(addRequest?.id)
    expect(current?.openerKey).toBe(`references:replace:${image.id}`)
    expect(current?.mode.kind).toBe('pick')
    expect(current?.anchor).toBe(anchor)
    expect(current?.anchor).toBe(pickerAnchor('references'))

    const next = upload('image-2', 'image')

    act(() => {
      if (current?.mode.kind === 'pick') {
        current.mode.onPick(next)
      }
    })

    expect(useGeneratorStore.getState().references).toEqual([next.id])
    expect(useGeneratorStore.getState().uploadsById[next.id]).toEqual(next)
  })
})
