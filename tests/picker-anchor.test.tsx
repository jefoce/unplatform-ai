// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FrameSlots } from '@/features/generator/frames/FrameSlots'
import { ReferencesBox } from '@/features/generator/references/ReferencesBox'
import { useGeneratorStore } from '@/features/generator/store/store'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import { closeMediaPicker, useMediaPickerStore } from '@/features/media-picker/picker/store'

import { required } from './helpers/required'
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

const image = upload('image-1', 'image')

function renderPanel(body: ReactNode): void {
  render(
    <>
      <div>
        {body}
        <button type="button">Outside</button>
      </div>
      <MediaPicker />
    </>,
  )
}

function referencesBox(): HTMLElement {
  return required(document.querySelector<HTMLElement>('[data-references-box]'), 'references box')
}

function requestAnchor(): HTMLElement | null {
  return useMediaPickerStore.getState().request?.anchor ?? null
}

function requestId(): number | undefined {
  return useMediaPickerStore.getState().request?.id
}

async function settlePicker(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
}

beforeEach(() => {
  mocks.useMediaQuery.mockReturnValue(true)
  vi.stubGlobal('ResizeObserver', Observer)

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    references: [image.id],
    uploadsById: uploadsOf(image),
    frames: { start: null, end: null },
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closeMediaPicker()
  mocks.useMediaQuery.mockReset()
  vi.unstubAllGlobals()
})

describe('picker anchor region', () => {
  it('anchors the picker to the references container when the add tile opens it', () => {
    renderPanel(<ReferencesBox />)

    const box = referencesBox()

    fireEvent.click(screen.getByRole('button', { name: 'Add references' }))

    expect(requestAnchor()).toBe(box)
  })

  it('anchors the empty state to the references container', () => {
    useGeneratorStore.setState({ references: [], uploadsById: {} })
    renderPanel(<ReferencesBox />)

    const box = referencesBox()

    fireEvent.click(screen.getByRole('button', { name: /^Add references/ }))

    expect(requestAnchor()).toBe(box)
  })

  it('keeps the picker open on a pointerdown inside the references container', async () => {
    renderPanel(<ReferencesBox />)

    fireEvent.click(screen.getByRole('button', { name: 'Add references' }))
    await settlePicker()

    const id = requestId()

    fireEvent.pointerDown(referencesBox(), { button: 0 })
    fireEvent.click(referencesBox())

    expect(requestId()).toBe(id)
  })

  it('closes the picker on a pointerdown elsewhere in the panel', async () => {
    renderPanel(<ReferencesBox />)

    fireEvent.click(screen.getByRole('button', { name: 'Add references' }))
    await settlePicker()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }))

    await waitFor(() => {
      expect(requestAnchor()).toBeNull()
    })
  })

  it('keeps the picker open on the add tile and does not reopen on a container click', async () => {
    renderPanel(<ReferencesBox />)

    const tile = screen.getByRole('button', { name: 'Add references' })

    fireEvent.click(tile)
    await settlePicker()

    const id = requestId()

    fireEvent.pointerDown(tile, { button: 0 })
    fireEvent.click(referencesBox())

    expect(requestId()).toBe(id)
  })

  it('anchors the picker to the frame slots container when a slot opens it', () => {
    useGeneratorStore.setState({
      references: [],
      uploadsById: {},
      frames: { start: null, end: null },
    })

    const view = render(<FrameSlots />)
    const container = required(view.container.firstElementChild, 'frame slots container')

    fireEvent.click(screen.getByRole('button', { name: 'Start frame' }))

    expect(requestAnchor()).toBe(container)
  })

  it('replaces the start frame request when the end slot opens the picker', () => {
    useGeneratorStore.setState({
      references: [],
      uploadsById: {},
      frames: { start: 'missing-start', end: null },
    })

    const view = render(<FrameSlots />)
    const container = required(view.container.firstElementChild, 'frame slots container')

    fireEvent.click(screen.getByRole('button', { name: 'Start frame' }))

    const startRequest = useMediaPickerStore.getState().request

    expect(startRequest?.openerKey).toBe('frame:start')

    fireEvent.click(screen.getByRole('button', { name: 'End frame' }))

    const current = useMediaPickerStore.getState().request

    expect(current?.id).not.toBe(startRequest?.id)
    expect(current?.openerKey).toBe('frame:end')
    expect(current?.anchor).toBe(container)
  })
})
