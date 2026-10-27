// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import type { ActionKey, PreviewActions } from '@/features/preview/preview-store'
import { PreviewFooter } from '@/features/preview/PreviewFooter'

import { upload } from './helpers/validation-fixtures'

const item = upload('clip', 'video')

afterEach(() => {
  cleanup()
})

function handleRun(_key: ActionKey): void {}

function isSelected(): boolean {
  return true
}

function isNotSelected(): boolean {
  return false
}

function renderFooter(actions: PreviewActions) {
  render(<PreviewFooter item={item} actions={actions} onRun={handleRun} />)
}

describe('PreviewFooter selection label', () => {
  it('shows Deselect and not Select for a selected item', () => {
    renderFooter({
      select: vi.fn<(item: UploadItem) => void>(),
      deselect: vi.fn<(item: UploadItem) => void>(),
      isSelected,
      available: () => {
        return ['deselect']
      },
    })

    expect(screen.getByRole('button', { name: 'Deselect' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
  })

  it('shows Select for an unselected item', () => {
    renderFooter({
      select: vi.fn<(item: UploadItem) => void>(),
      deselect: vi.fn<(item: UploadItem) => void>(),
      isSelected: isNotSelected,
      available: () => {
        return ['select']
      },
    })

    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Deselect' })).toBeNull()
  })

  it('hides both selection buttons when the max rule allows neither', () => {
    renderFooter({
      select: vi.fn<(item: UploadItem) => void>(),
      deselect: vi.fn<(item: UploadItem) => void>(),
      isSelected: isNotSelected,
      available: () => {
        return []
      },
    })

    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deselect' })).toBeNull()
  })
})
