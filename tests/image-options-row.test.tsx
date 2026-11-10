// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ImageOptionsRow } from '@/features/image-generator/options/ImageOptionsRow'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { imageBackgroundOptions, imageResolutionOptions } from '../src/core/presets/common/options'
import { GPT_IMAGE_2 } from '../src/core/presets/image/openai/gpt-image-2'
import { SEEDREAM_5_LITE } from '../src/core/presets/image/seedream/seedream-5-0-lite'
import { IMAGE_RESOLUTIONS, type ImagePreset } from '../src/core/presets/image/types'
import { Observer } from './helpers/history'
import { required } from './helpers/required'

const RESOLUTION_DETAILS = {
  '512': '512px',
  '768': '768px',
  '1K': '1024px',
  '1.5K': '1536px',
  '2K': '2048px',
  '4K': '4096px',
} as const

const PRESET: ImagePreset = {
  ...GPT_IMAGE_2,
  resolutions: imageResolutionOptions([...IMAGE_RESOLUTIONS]),
  defaultResolution: '1K',
  backgrounds: imageBackgroundOptions(['auto', 'opaque', 'transparent']),
  defaultBackground: 'auto',
}

async function openMenu(trigger: RegExp, header: string): Promise<HTMLElement> {
  fireEvent.click(required(screen.getByRole('button', { name: trigger }), header))

  const title = await screen.findByText(header)

  return required(title.parentElement, `${header} menu`)
}

const CHIPS = [
  { name: /^Aspect:/, aria: 'Aspect: 1:1', value: '1:1', control: 'Aspect' },
  { name: /^Resolution:/, aria: 'Resolution: 1K', value: '1K', control: 'Resolution' },
  { name: /^Quality:/, aria: 'Quality: High', value: 'High', control: 'Quality' },
  { name: /^Background:/, aria: 'Background: Opaque', value: 'Opaque', control: 'Background' },
]

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  useImageGeneratorStore.setState({
    aspectRatio: '1:1',
    resolution: '1K',
    quality: 'high',
    background: 'opaque',
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ImageOptionsRow icon chips', () => {
  it.each(CHIPS)('renders the $control icon and value only', (chip) => {
    render(<ImageOptionsRow preset={PRESET} />)

    const trigger = required(screen.getByRole('button', { name: chip.name }), chip.control)

    expect(trigger.getAttribute('aria-label')).toBe(chip.aria)
    expect(trigger.textContent).toBe(chip.value)
    expect(trigger.querySelector('svg, .rounded-xs')).not.toBeNull()
    expect(within(trigger).queryByText(chip.control)).toBeNull()
  })

  it('keeps a fixed icon slot and the compact chip sizing', () => {
    render(<ImageOptionsRow preset={PRESET} />)

    const trigger = screen.getByRole('button', { name: /^Aspect:/ })

    expect(trigger.className).toContain('text-sm')
    expect(trigger.className).toContain('font-semibold')
    expect(trigger.className).toContain('h-8')
    expect(trigger.className).toContain('px-2.5')
    expect(trigger.className).toContain('gap-1.5')
    expect(trigger.className).toContain('whitespace-nowrap')
    expect(trigger.className).toContain('shrink-0')
    expect(trigger.firstElementChild?.className).toContain('size-4')
  })
})

describe('ImageOptionsRow seed chip', () => {
  it('shows the locked seed the image details set', () => {
    useImageGeneratorStore.setState({ presetId: SEEDREAM_5_LITE.id, seed: 42 })

    render(<ImageOptionsRow preset={SEEDREAM_5_LITE} />)

    expect(screen.getByRole('button', { name: '42' })).not.toBeNull()
  })

  it('hides the seed chip for a preset without seeds', () => {
    useImageGeneratorStore.setState({ presetId: PRESET.id, seed: null })

    render(<ImageOptionsRow preset={PRESET} />)

    expect(screen.queryByRole('button', { name: 'Random' })).toBeNull()
  })
})

describe('ImageOptionsRow menu rows', () => {
  it('draws a ratio icon on every aspect row', async () => {
    render(<ImageOptionsRow preset={PRESET} />)

    const menu = await openMenu(/^Aspect:/, 'Aspect')
    const rows = within(menu).getAllByRole('radio')

    expect(rows).toHaveLength(PRESET.aspectRatios.length)

    for (const row of rows) {
      expect(row.querySelector('svg, .rounded-xs')).not.toBeNull()
      const label = required(row.querySelector('[class~="text-sm/5"]'), 'row label')

      expect(label.className).toContain('text-sm')
    }
  })

  it('gives each background row its own icon', async () => {
    render(<ImageOptionsRow preset={PRESET} />)

    const menu = await openMenu(/^Background:/, 'Background')

    const icons = ['Auto', 'Opaque', 'Transparent'].map((label) => {
      const row = required(within(menu).getByText(label).closest('button'), `${label} row`)
      const icon = required(row.querySelector('svg'), `${label} icon`)

      return icon.getAttribute('class')
    })

    expect(icons[0]).toContain('lucide-wand-2')
    expect(icons[1]).toContain('lucide-square')
    expect(icons[2]).toContain('lucide-square-dashed')
    expect(new Set(icons).size).toBe(3)
  })

  it('shows the grayed pixel line on every resolution row', async () => {
    render(<ImageOptionsRow preset={PRESET} />)

    const menu = await openMenu(/^Resolution:/, 'Resolution')
    const rows = within(menu).getAllByRole('radio')

    expect(rows).toHaveLength(IMAGE_RESOLUTIONS.length)

    for (const [index, value] of IMAGE_RESOLUTIONS.entries()) {
      const row = required(rows[index], `${value} row`)
      const detail = required(row.querySelector('.text-xxs'), `${value} detail`)

      expect(detail.textContent).toBe(RESOLUTION_DETAILS[value])
      expect(detail.className).toContain('text-fg-2')
      expect(row.querySelector('svg')).not.toBeNull()
    }

    expect(within(menu).queryByText('--')).toBeNull()
    expect(within(menu).queryByText(/Saved rates/)).toBeNull()
    expect(menu.textContent).not.toContain('$')
  })

  it('keeps quality rows to a single line', async () => {
    render(<ImageOptionsRow preset={PRESET} />)

    const menu = await openMenu(/^Quality:/, 'Quality')

    for (const row of within(menu).getAllByRole('radio')) {
      expect(row.querySelector('.text-xxs')).toBeNull()
      expect(row.querySelector('svg:not(.text-accent)')).toBeNull()
    }
  })
})
