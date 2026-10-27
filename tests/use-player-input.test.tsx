// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type SeekKeys, usePlayerInput } from '@/features/player/use-player-input'
import type { VideoApi } from '@/features/player/use-video-state'

interface PlayerProbeProps {
  seekBy: (delta: number) => void
  seekKeys?: SeekKeys
}

function createVideo(seekBy: (delta: number) => void): VideoApi {
  return {
    paused: true,
    muted: false,
    time: 0,
    duration: 10,
    fullscreen: false,
    togglePlay: () => {},
    toggleMute: () => {},
    seek: () => {},
    seekBy,
    toggleFullscreen: () => {},
  }
}

function PlayerProbe(props: PlayerProbeProps) {
  const { seekBy, seekKeys } = props
  const video = createVideo(seekBy)
  const handlers = usePlayerInput({ isActive: true, video, seekKeys })

  return <div data-testid="player" tabIndex={0} onKeyDown={handlers.onKeyDown} />
}

afterEach(() => {
  cleanup()
})

describe('usePlayerInput seek keys', () => {
  it('seeks on plain arrows by default', () => {
    const seekBy = vi.fn()

    render(<PlayerProbe seekBy={seekBy} />)
    const player = screen.getByTestId('player')

    expect(fireEvent.keyDown(player, { key: 'ArrowLeft' })).toBe(false)
    expect(fireEvent.keyDown(player, { key: 'ArrowRight' })).toBe(false)
    expect(seekBy).toHaveBeenNthCalledWith(1, -5)
    expect(seekBy).toHaveBeenNthCalledWith(2, 5)
  })

  it('leaves plain arrows for the chain with shiftArrows', () => {
    const seekBy = vi.fn()

    render(<PlayerProbe seekBy={seekBy} seekKeys="shiftArrows" />)
    const player = screen.getByTestId('player')

    expect(fireEvent.keyDown(player, { key: 'ArrowLeft' })).toBe(true)
    expect(fireEvent.keyDown(player, { key: 'ArrowRight' })).toBe(true)
    expect(seekBy).not.toHaveBeenCalled()
  })

  it('seeks on shift arrows with shiftArrows', () => {
    const seekBy = vi.fn()

    render(<PlayerProbe seekBy={seekBy} seekKeys="shiftArrows" />)
    const player = screen.getByTestId('player')

    expect(fireEvent.keyDown(player, { key: 'ArrowLeft', shiftKey: true })).toBe(false)
    expect(fireEvent.keyDown(player, { key: 'ArrowRight', shiftKey: true })).toBe(false)
    expect(seekBy).toHaveBeenNthCalledWith(1, -5)
    expect(seekBy).toHaveBeenNthCalledWith(2, 5)
  })
})
