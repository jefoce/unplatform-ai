// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'
import { useSelectionStore } from '@/features/history/selection/selection-store'

import { ZOOM_DEFAULT } from '../src/core/constants'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { handleNoop, item, Observer } from './helpers/history'
import { required } from './helpers/required'

const WIDTHS = [216, 240, 486] as const

const RECORD_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3400'

function imageRecord(status: ImageRecord['status'], isGrace = false): ImageRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    submit: isGrace
      ? { stage: 'grace', notBefore: new Date(Date.now() + 5000).toISOString() }
      : undefined,
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'unknown',
      billed: null,
    },
  }
}

type State = 'pending' | 'grace' | 'saving' | 'failed'

const IMAGE_STATUSES: Record<State, ImageRecord['status']> = {
  pending: 'partial',
  grace: 'submitting',
  saving: 'saving',
  failed: 'failed',
}

const VIDEO_STATUSES: Record<State, GenerationRecord['status']> = {
  pending: 'pending',
  grace: 'submitting',
  saving: 'in_progress',
  failed: 'failed',
}

function imageItemFor(state: State) {
  const [entry] = imageItems(imageRecord(IMAGE_STATUSES[state], state === 'grace'))

  return required(entry, 'image item')
}

function videoItemFor(state: State) {
  return item('v', {
    status: VIDEO_STATUSES[state],
    submit:
      state === 'grace'
        ? { stage: 'grace', notBefore: new Date(Date.now() + 5000).toISOString() }
        : undefined,
  })
}

interface RenderParams {
  width: number
  isImage: boolean
  state: State
}

function renderState(params: RenderParams) {
  const { width, isImage, state } = params
  const gridItem = isImage ? imageItemFor(state) : videoItemFor(state)

  return render(
    <div style={{ width }}>
      <HistoryTile item={gridItem} zoom={ZOOM_DEFAULT} onOpen={handleNoop} mediaWidth={0} />
    </div>,
  )
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  useSelectionStore.getState().clear()
})

afterEach(() => {
  cleanup()
  useSelectionStore.getState().clear()
  vi.unstubAllGlobals()
})

describe.each(WIDTHS)('%i px tile', (width) => {
  it.each(['image', 'video'] as const)('uses container sizing for %s statuses', (kind) => {
    const { container } = renderState({
      width,
      isImage: kind === 'image',
      state: 'pending',
    })

    const tile = required(container.querySelector('[role="button"]'), 'tile')
    const pill = required(tile.querySelector('[data-status-pill]'), 'status pill')
    const label = required(pill.querySelector('[data-status-label]'), 'status label')

    expect(tile.className).toContain('@container')
    expect(pill.className).toContain('@min-[240px]:h-9')
    expect(label.className).toContain('@max-[239px]:sr-only')
    expect(label.className).toContain('not-sr-only')
  })

  it.each(['image', 'video'] as const)(
    'disables a %s saving tile only when it cannot open',
    (kind) => {
      const { container } = renderState({ width, isImage: kind === 'image', state: 'saving' })
      const tile = required(container.querySelector('[role="button"]'), 'tile')
      const isDisabled = kind === 'image'

      expect(tile.getAttribute('aria-disabled')).toBe(String(isDisabled))
      expect(tile.getAttribute('tabindex')).toBe(isDisabled ? '-1' : '0')
    },
  )

  it.each(['image', 'video'] as const)(
    'keeps the %s grace cancel icon-only when compact',
    (kind) => {
      const { container } = renderState({ width, isImage: kind === 'image', state: 'grace' })
      const cancel = required(container.querySelector('[data-grace-cancel]'), 'grace cancel')
      const label = required(cancel.querySelector('[data-status-label]'), 'cancel label')

      expect(cancel.className).toContain('@min-[240px]:h-9')
      expect(label.className).toContain('@max-[239px]:sr-only')
    },
  )

  it.each(['image', 'video'] as const)('hides the %s failed pill while selecting', (kind) => {
    const { container } = renderState({ width, isImage: kind === 'image', state: 'failed' })
    const tile = required(container.querySelector('[role="button"]'), 'tile')
    const pill = required(tile.querySelector('[data-status-pill]'), 'status pill')
    const wrapper = required(pill.parentElement, 'pill wrapper')

    expect(wrapper.className.split(' ')).not.toContain('opacity-0')

    useSelectionStore.getState().setMany([tile.getAttribute('id') ?? RECORD_ID], true)

    cleanup()
    const selected = renderState({ width, isImage: kind === 'image', state: 'failed' })

    const selectedPill = required(
      required(selected.container.querySelector('[role="button"]'), 'tile').querySelector(
        '[tabindex="0"]',
      ),
      'status pill',
    )

    expect(required(selectedPill.parentElement, 'pill wrapper').className.split(' ')).toContain(
      'opacity-0',
    )
  })
})
