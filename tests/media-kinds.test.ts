import { describe, expect, it } from 'vitest'

import { acceptFiles, acceptForKinds, extensionsForKinds, kindFromFile } from '@/core/media-kinds'

describe('kindFromFile', () => {
  it('falls back to the MIME type when the name has no usable extension', () => {
    expect(kindFromFile({ name: 'image', type: 'image/png' })).toBe('image')
    expect(kindFromFile({ name: 'clip.mp4', type: '' })).toBe('video')
    expect(kindFromFile({ name: 'notes.pdf', type: 'application/pdf' })).toBeNull()
  })
})

describe('extensionsForKinds', () => {
  it('returns the extensions of the requested kinds without dots', () => {
    expect(extensionsForKinds(['image'])).toEqual(['jpg', 'jpeg', 'png', 'webp'])
    expect(extensionsForKinds(['video', 'audio'])).toContain('mp4')

    expect(
      extensionsForKinds(['audio']).every((ext) => {
        return !ext.startsWith('.')
      }),
    ).toBe(true)
  })

  it('uses preset formats when given', () => {
    expect(extensionsForKinds(['video'], { video: ['mp4', 'mov'] })).toEqual(['mp4', 'mov'])
    expect(acceptForKinds(['video'], { video: ['mp4'] })).toBe('.mp4')
  })
})

describe('acceptFiles', () => {
  it('keeps allowed kinds and counts the rest', () => {
    const files = [
      { name: 'a.png', type: 'image/png' },
      { name: 'b.gif', type: 'image/gif' },
      { name: 'c.mp4', type: 'video/mp4' },
    ]

    const { accepted, skipped } = acceptFiles({ files, kinds: ['image'] })

    expect(
      accepted.map((file) => {
        return file.name
      }),
    ).toEqual(['a.png'])

    expect(skipped).toBe(2)
  })

  it('rejects extensions outside the preset formats', () => {
    const files = [
      { name: 'a.webm', type: 'video/webm' },
      { name: 'b.mp4', type: 'video/mp4' },
    ]

    const { accepted, skipped } = acceptFiles({
      files,
      kinds: ['video'],
      extensions: { video: ['mp4', 'mov'] },
    })

    expect(
      accepted.map((file) => {
        return file.name
      }),
    ).toEqual(['b.mp4'])

    expect(skipped).toBe(1)
  })
})
