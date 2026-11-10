// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AboutSection } from '@/features/updates/AboutSection'

const platformMock = vi.hoisted(() => {
  return { openExternal: vi.fn(), openNotices: vi.fn() }
})

vi.mock('@/lib/platform', () => {
  return { platform: platformMock }
})

afterEach(() => {
  cleanup()
})

describe('AboutSection links', () => {
  it('shows keyboard focus on every link button', () => {
    render(<AboutSection version="0.5.0" />)

    const links = [
      screen.getByRole('button', { name: 'Licensed under AGPL-3.0' }),
      screen.getByRole('button', { name: 'Source code' }),
      screen.getByRole('button', { name: 'Third-party notices' }),
    ]

    for (const link of links) {
      expect(link.classList.contains('focus-visible:text-fg')).toBe(true)
      expect(link.classList.contains('focus-visible:underline')).toBe(true)
    }
  })
})
