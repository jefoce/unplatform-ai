// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { preloadPosters } from '@/lib/preload-posters'

class ImageStub {
  static sources: string[] = []

  set src(value: string) {
    ImageStub.sources.push(value)
  }
}

beforeEach(() => {
  ImageStub.sources = []
  vi.stubGlobal('Image', ImageStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preloadPosters', () => {
  it('requests every non-empty source', () => {
    preloadPosters(['/a.jpg', '', undefined, null, '/b.jpg'])

    expect(ImageStub.sources).toEqual(['/a.jpg', '/b.jpg'])
  })
})
