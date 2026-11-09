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

const CUSTOM_VIDEO_ROW: PickerRow = {
  id: 'custom.cu1.video',
  title: 'Custom Video',
  icon: 'sparkles',
  description: '',
  priceText: '',
  kind: 'custom',
  badge: 'CU1',
  status: 'available',
  reason: null,
  isCustom: true,
  resolutionText: '352\u20131088p',
  durationText: '4-15 s',
  referenceCount: 2,
  hasAudio: true,
  mediaKind: 'video',
}

describe('ModelCustomRow video badges', () => {
  it('renders the resolution range, duration, audio and reference badges', () => {
    render(
      <ModelCustomRow model={CUSTOM_VIDEO_ROW} entry={null} selected={false} onSelect={noop} />,
    )

    expect(screen.getByText('352\u20131088p')).toBeTruthy()
    expect(screen.getByText('4-15 s')).toBeTruthy()
    expect(screen.getByLabelText('Audio')).toBeTruthy()
    expect(screen.getByText('2 refs')).toBeTruthy()
  })

  it('keeps the API video row labels unchanged', () => {
    const preset = getPreset('wan-3.0')

    render(
      <ModelVideoRow
        model={videoPickerModel(preset, null)}
        preset={preset}
        entry={null}
        selected={false}
        onSelect={noop}
      />,
    )

    expect(screen.getByText('480p-1080p')).toBeTruthy()
    expect(screen.getByText('5-30s')).toBeTruthy()
    expect(screen.getByLabelText('Audio')).toBeTruthy()
  })
})
