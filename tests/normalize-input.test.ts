import { describe, expect, it } from 'vitest'

import { inputForSubmit } from '@/core/normalize-input'

import { input } from './helpers/normalize-fixtures'

describe('inputForSubmit', () => {
  it('drops references on the frames tab', () => {
    const result = inputForSubmit(input({ tab: 'frames' }))

    expect(result.references).toEqual([])
  })

  it('keeps start only when no end frame is set', () => {
    const result = inputForSubmit(input({ tab: 'frames', frames: { start: 'start', end: null } }))

    expect(result.frames).toEqual({ start: 'start', end: null })
  })

  it('keeps both frames', () => {
    expect(inputForSubmit(input({ tab: 'frames' })).frames).toEqual({
      start: 'start',
      end: 'end',
    })
  })

  it('clears frames on the references tab', () => {
    const result = inputForSubmit(input())

    expect(result.frames).toEqual({ start: null, end: null })
    expect(result.references).toEqual(['ref'])
  })

  it('does not mutate and preserves other fields', () => {
    const original = input({ tab: 'frames' })
    const result = inputForSubmit(original)

    expect(original.frames).toEqual({ start: 'start', end: 'end' })
    expect(original.references).toEqual(['ref'])
    expect(result).not.toBe(original)

    expect(result).toMatchObject({
      presetId: 'wan-3.0',
      prompt: 'A cat',
      audio: true,
      duration: 5,
      aspectRatio: '16:9',
      resolution: '1080p',
      seed: 7,
    })
  })
})
