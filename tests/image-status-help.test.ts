import { describe, expect, it } from 'vitest'

import { imageStatusHelp, STATUS_HELP, statusHelpText } from '@/core/status-help'
import { imageStatusView } from '@/features/history/status/status-view'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { imageItems } from '../src/lib/feed/output-items'
import { required } from './helpers/required'

function record(
  stage: 'grace' | 'uploading' | 'sending',
  provider: ImageRecord['provider'] = 'openrouter',
): ImageRecord {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3400',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'submitting',
    provider,
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
    submit: { stage, notBefore: '2026-01-01T00:00:00.000Z' },
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

const IMAGE_HELP_KEYS = [
  'processing',
  'uploading',
  'sending',
  'pending',
  'generating',
  'completed',
  'failed',
  'expired',
  'cancelled',
] as const

describe('image status help', () => {
  it.each([
    ['grace', 'Processing'],
    ['uploading', 'Uploading'],
    ['sending', 'Sending'],
  ] as const)('reads the submit stage for %s', (stage, label) => {
    const [item] = imageItems(record(stage))
    const view = imageStatusView(required(item, 'image item'))

    expect(view.help.label).toBe(label)
  })

  it.each(IMAGE_HELP_KEYS)('uses image wording for %s', (key) => {
    const text = statusHelpText(imageStatusHelp(key))

    expect(text.toLowerCase()).not.toContain('video')
    expect(text).not.toContain('R2')
  })

  it('says the model makes an image', () => {
    expect(imageStatusHelp('generating').what).toBe('The model is making your image')
  })

  it('shows generating while the image is saving and completed once saved', () => {
    const [pending] = imageItems({ ...record('grace'), status: 'saving', submit: undefined })

    expect(imageStatusView(required(pending, 'image item')).help.what).toBe(
      'The model is making your image',
    )

    expect(imageStatusView(required(pending, 'image item')).help.label).toBe('Generating')

    expect(STATUS_HELP.processing.what).toBe('Waiting 10 seconds before sending')
  })

  it('uses ComfyUI wording for custom image uploading', () => {
    const [item] = imageItems(record('uploading', 'custom'))
    const view = imageStatusView(required(item, 'image item'))

    expect(view.help.what).toBe('Sending your reference files to ComfyUI')
    expect(view.help.label).toBe('Uploading')
  })

  it('uses ComfyUI wording for custom image pending', () => {
    expect(imageStatusHelp('pending', 'custom').what).toBe(
      'ComfyUI accepted it and is starting the workflow',
    )
  })
})
