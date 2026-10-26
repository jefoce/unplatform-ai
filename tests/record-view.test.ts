import { describe, expect, it } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { posterSrc } from '@/features/history/actions/record-view'

const record = {
  output: { video: 'clip.mp4', preview: 'clip.preview.png' },
} as GenerationRecord

describe('posterSrc', () => {
  it('rounds the requested width up to the next bucket', () => {
    expect(posterSrc(record, 80)).toContain('w=320')
    expect(posterSrc(record, 321)).toContain('w=640')
    expect(posterSrc(record, 640)).toContain('w=640')
    expect(posterSrc(record, 900)).toContain('w=960')
    expect(posterSrc(record, 1280)).toContain('w=1280')
  })

  it('caps at the last bucket', () => {
    expect(posterSrc(record, 1281)).toContain('w=1920')
    expect(posterSrc(record, 9999)).toContain('w=1920')
  })

  it('defaults to the preview width', () => {
    expect(posterSrc(record)).toContain('w=640')
  })
})
