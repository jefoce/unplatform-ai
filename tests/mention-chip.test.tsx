// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MediaKind } from '../src/core/media/media-types'
import { required } from './helpers/required'
import { upload, uploadsOf } from './helpers/validation-fixtures'

vi.stubGlobal('matchMedia', () => {
  return { addEventListener: vi.fn(), matches: false, removeEventListener: vi.fn() }
})

const { PromptField } = await import('@/features/generator/prompt/PromptField')

const onEvent = vi.fn()

afterEach(() => {
  cleanup()
})

interface Case {
  kind: MediaKind
  prompt: string
  label: string
}

const CASES: Case[] = [
  { kind: 'image', prompt: '@Image 1', label: 'Image 1' },
  { kind: 'video', prompt: '@Video 1', label: 'Video 1' },
]

describe('reference chip resolution', () => {
  it.each(CASES)('resolves an attached $kind mention to its upload', (testCase) => {
    const item = upload('attached', testCase.kind)
    const mentions = { references: [item.id], uploadsById: uploadsOf(item) }

    render(
      <PromptField
        value={testCase.prompt}
        onChange={onEvent}
        onSubmit={onEvent}
        isReferences
        mentions={mentions}
      />,
    )

    return waitFor(() => {
      const chip = required(
        screen.getByText(`@${testCase.label}`).closest('[data-beautiful-mention]'),
        'mention chip',
      )

      expect(chip.getAttribute('title')).toContain(item.originalName)
      expect(chip.className).toContain('text-accent')
      expect(chip.className).not.toContain('text-danger')
    })
  })
})
