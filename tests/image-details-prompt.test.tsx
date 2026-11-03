// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DetailsPanel } from '@/features/history/details/DetailsPanel'

import { videoItem } from '../src/lib/feed/output-items'
import { record } from './helpers/history'
import { imageItem, REFERENCE_ID, referenceSnapshot } from './helpers/image-details-fixture'
import { required } from './helpers/required'

afterEach(() => {
  cleanup()
})

describe('image prompt details', () => {
  it('renders the prompt through the same block as video', () => {
    const prompt = 'a cat in [Image 1]'

    const { container } = render(
      <DetailsPanel
        item={imageItem({
          prompt,
          references: [REFERENCE_ID],
          inputsSnapshot: referenceSnapshot(),
        })}
      />,
    )

    const imageText = required(container.querySelector('p'), 'image prompt')

    const chip = screen.getByText('@Image 1')

    expect(imageText.textContent).toBe('a cat in @Image 1')

    expect(chip.querySelector('img')?.getAttribute('src')).toContain(
      `/api/thumbs/uploads/${REFERENCE_ID}`,
    )

    cleanup()

    const video = render(<DetailsPanel item={videoItem(record('video-details'))} />)
    const videoText = required(video.container.querySelector('p'), 'video prompt')

    expect(imageText.className).toBe(videoText.className)
  })

  it('copies the canonical image prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <DetailsPanel
        item={imageItem({
          prompt: 'a cat in [Image 1]',
          references: [REFERENCE_ID],
          inputsSnapshot: referenceSnapshot(),
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('a cat in @Image 1')
    })
  })

  it('shows No prompt when the record has none', () => {
    render(<DetailsPanel item={imageItem({ prompt: '' })} />)

    expect(screen.getByText('No prompt')).not.toBeNull()
  })

  it('falls back to the same missing-upload label as video', async () => {
    const { container } = render(
      <DetailsPanel item={imageItem({ references: [REFERENCE_ID], inputsSnapshot: {} })} />,
    )

    const thumb = required(
      container.querySelector<HTMLElement>('[role="button"][tabindex="0"]'),
      'reference thumb',
    )

    fireEvent.focus(thumb)

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toBe('Image 1 \u00b7 Deleted upload')
  })
})
