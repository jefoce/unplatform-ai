import { describe, expect, it } from 'vitest'

import { modelBase, modelSlug } from '../src/core/media/file-names'

describe('modelSlug', () => {
  it('kebab-cases plain titles', () => {
    expect(modelSlug('MiniMax H3')).toBe('minimax-h3')
    expect(modelSlug('Qwen 2.1')).toBe('qwen-2-1')
    expect(modelSlug('Seedance 1.0 Pro')).toBe('seedance-1-0-pro')
  })

  it('strips combining marks', () => {
    expect(modelSlug('Café Ünïcode')).toBe('cafe-unicode')
  })

  it('drops emoji', () => {
    expect(modelSlug('🎬 Epic')).toBe('epic')
  })

  it('returns an empty string for a label with nothing usable', () => {
    expect(modelSlug('')).toBe('')
    expect(modelSlug('🎬')).toBe('')
  })

  it('caps at 64 characters and leaves no trailing dash', () => {
    const slug = modelSlug('a'.repeat(200))

    expect(slug).toHaveLength(64)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('modelBase', () => {
  it('prefers the snapshot title over the current preset title', () => {
    const record = {
      preset: { id: 'old', title: 'Old Model', slug: 'old-model' },
      presetSnapshot: { id: 'old', title: 'New Model', family: 'video' },
    }

    expect(modelBase(record)).toBe('new-model')
  })

  it('falls back to the preset title without a snapshot', () => {
    const record = { preset: { id: 'v', title: 'Plain Model', slug: 'plain-model' } }

    expect(modelBase(record)).toBe('plain-model')
  })
})
