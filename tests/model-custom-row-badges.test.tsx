// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { ModelCustomRow } from '@/features/generator/model/ModelCustomRow'
import { ModelVideoRow } from '@/features/generator/model/ModelVideoRow'
import type { PickerRow } from '@/features/generator/model/picker-groups'
import { videoPickerModel } from '@/features/generator/model/video-picker-model'

afterEach(cleanup)

function noop(): void {}

const LONG_DESCRIPTION =
  'A very long model description that should wrap across two lines and then clamp with an ellipsis when it keeps growing.'

const CUSTOM_VIDEO_ROW: PickerRow = {
  id: 'custom.cu1.video',
  title: 'Custom Video',
  icon: 'sparkles',
  description: LONG_DESCRIPTION,
  priceText: '',
  kind: 'custom',
  badge: 'CU1',
  status: 'available',
  reason: null,
  isCustom: true,
  resolutionText: '352\u20131088p',
  durationText: '4-15 s',
  hasAudio: true,
  mediaKind: 'video',
}

describe('ModelCustomRow video badges', () => {
  it('renders resolution, duration and audio badges without a description or references badge', () => {
    render(
      <ModelCustomRow model={CUSTOM_VIDEO_ROW} entry={null} selected={false} onSelect={noop} />,
    )

    const resolution = screen.getByText('352\u20131088p')
    const duration = screen.getByText('4-15 s')
    const audio = screen.getByLabelText('Audio')

    expect(resolution.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(duration.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(audio.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(audio.getAttribute('aria-label')).toBe('Audio')
    expect(screen.queryByText(LONG_DESCRIPTION)).toBeNull()
    expect(screen.queryByText(/refs/)).toBeNull()
  })

  it('keeps the API video row badges without a description', () => {
    const preset = getPreset('wan-3.0')

    render(
      <ModelVideoRow
        model={{
          ...videoPickerModel(preset, null),
          description: LONG_DESCRIPTION,
        }}
        preset={preset}
        entry={null}
        selected={false}
        onSelect={noop}
      />,
    )

    expect(screen.getByText('480p-1080p')).toBeTruthy()
    expect(screen.getByText('5-30s')).toBeTruthy()
    expect(screen.getByLabelText('Audio')).toBeTruthy()
    expect(screen.queryByText(LONG_DESCRIPTION)).toBeNull()
  })
})
