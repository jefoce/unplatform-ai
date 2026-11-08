// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import type { VideoPreset } from '@/core/presets/video/types'
import { ModelPicker } from '@/features/generator/model/ModelPicker'
import { useGeneratorStore } from '@/features/generator/store/store'
import { refreshCatalog, useCatalog, useModelEntry } from '@/lib/api/catalog'

import { getPreset } from '../src/core/presets'

vi.mock('@/lib/api/catalog', () => {
  return {
    useCatalog: vi.fn(),
    refreshCatalog: vi.fn(),
    useModelEntry: vi.fn(() => {
      return null
    }),
  }
})

const mockCatalog = vi.mocked(useCatalog)
const mockRefresh = vi.mocked(refreshCatalog)
const mockEntry = vi.mocked(useModelEntry)

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function handleNoop(): void {}

const BASE = getPreset('wan-3.0')

function customPreset(id: string, title: string): VideoPreset {
  return {
    ...BASE,
    id,
    title,
    family: 'custom',
    bindings: [
      {
        provider: 'custom',
        modelId: id,
        pricing: { formula: 'perRun', skuRules: [], fallback: { per_run: 0.5 } },
        transport: { image: 'base64', video: 'upload', audio: 'upload' },
      },
    ],
  }
}

function entry(params: {
  preset: VideoPreset
  status?: CatalogEntry['status']
  reason?: string | null
  badge?: string
  perRun?: number
  priceUnit?: 'run' | 'second'
}): CatalogEntry {
  const { preset, status = 'available', reason = null, badge = 'CU1', perRun, priceUnit } = params

  return {
    modelId: preset.id,
    presetId: preset.id,
    provider: 'custom',
    status,
    reason,
    pricing: isNil(perRun)
      ? null
      : {
          skus: { per_run: perRun },
          listSkus: {},
          discount: 0,
          source: 'fallback',
          fetchedAt: '2026-01-01T00:00:00.000Z',
        },
    source: {
      kind: 'custom',
      instanceId: 'cu1',
      badge,
      workflowName: 'Wan 2.2 workflow',
      local: true,
      priceUnit,
    },
    preset,
  }
}

function catalogOf(entries: CatalogEntry[]): ModelCatalog {
  return { entries, fetchedAt: '2026-01-01T00:00:00.000Z' }
}

const AVAILABLE = entry({ preset: customPreset('custom.cu1.wan22', 'Wan 2.2 I2V') })

const STALE = entry({
  preset: customPreset('custom.cu1.flux', 'Flux Dev'),
  reason: 'Workflow changed in ComfyUI since the last save',
})

const UNREACHABLE = entry({
  preset: customPreset('custom.cu2.sdxl', 'SDXL Turbo'),
  status: 'unverified',
  reason: 'ComfyUI is not reachable.',
  badge: 'CU2',
})

const MISSING = entry({
  preset: customPreset('custom.cu1.gone', 'Gone Workflow'),
  status: 'missing',
  reason: 'This workflow is gone from ComfyUI.',
})

const INVALID = entry({
  preset: customPreset('custom.cu1.broken', 'Broken Workflow'),
  status: 'invalid',
  reason: 'This workflow cannot run in ComfyUI.',
})

function useEntries(entries: CatalogEntry[]): void {
  mockCatalog.mockReturnValue({
    catalog: catalogOf(entries),
    isLoading: false,
    isValidating: false,
  })
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: handleNoop, removeEventListener: handleNoop }
  })

  mockRefresh.mockReset()
  mockRefresh.mockResolvedValue(undefined)
  mockEntry.mockReturnValue(null)
  useGeneratorStore.setState({ presetId: 'wan-3.0' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function openPicker(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /Model/ }))

  return screen.getByRole('dialog')
}

describe('custom model picker', () => {
  it('groups OpenRouter first and sorts custom rows by badge', () => {
    useEntries([UNREACHABLE, AVAILABLE])

    render(<ModelPicker />)
    const dialog = openPicker()

    const headings = within(dialog).getAllByText(/^(OpenRouter|ComfyUI)$/)

    expect(
      headings.map((node) => {
        return node.textContent
      }),
    ).toEqual(['OpenRouter', 'ComfyUI'])

    const rows = within(dialog).getAllByRole('button', { pressed: false })

    expect(rows[0]?.textContent).toContain('CU1')
    expect(rows[1]?.textContent).toContain('CU2')
  })

  it('shows the badge, workflow subtitle and a stale warning icon', () => {
    useEntries([AVAILABLE, STALE])

    render(<ModelPicker />)
    const dialog = openPicker()

    expect(within(dialog).getByText('Wan 2.2 I2V')).toBeTruthy()
    expect(within(dialog).getAllByText('Wan 2.2 workflow')).toHaveLength(2)
    expect(within(dialog).getAllByText('CU1').length).toBeGreaterThan(0)

    const staleRow = within(dialog).getByRole('button', { name: /Flux Dev/ })

    expect((staleRow as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables an unreachable row and hides a missing one', () => {
    useEntries([AVAILABLE, UNREACHABLE, MISSING])

    render(<ModelPicker />)
    const dialog = openPicker()

    const unreachable = within(dialog).getByRole('button', { name: /SDXL Turbo/ })

    expect((unreachable as HTMLButtonElement).disabled).toBe(true)
    expect(unreachable.textContent).toContain('(unreachable)')
    expect(within(dialog).queryByText('Gone Workflow')).toBeNull()
  })

  it('renders an invalid row as muted and disabled with its reason tooltip', async () => {
    useEntries([INVALID])

    render(<ModelPicker />)
    const dialog = openPicker()

    const invalid = within(dialog).getByRole('button', { name: /Broken Workflow/ })

    expect((invalid as HTMLButtonElement).disabled).toBe(true)
    expect(invalid.className).toContain('opacity-50')

    fireEvent.pointerEnter(invalid)
    fireEvent.pointerMove(invalid)

    const tooltip = await screen.findByRole('tooltip')

    expect(tooltip.textContent).toContain(INVALID.reason ?? '')
  })

  it('uses the endpoint perRun override and hides a local zero price', () => {
    useEntries([
      entry({ preset: customPreset('custom.cu1.override', 'Override Model'), perRun: 2 }),
      entry({ preset: customPreset('custom.cu1.free', 'Free Model'), perRun: 0 }),
    ])

    render(<ModelPicker />)
    const dialog = openPicker()

    expect(within(dialog).getByText('$2.00 / run')).toBeTruthy()
    expect(within(dialog).queryByText('$0.00 / run')).toBeNull()
    expect(within(dialog).queryByText('$0.50 / run')).toBeNull()
  })

  it('keeps a missing selected model in the trigger with its snapshot title', () => {
    useEntries([MISSING])
    mockEntry.mockReturnValue({ ...MISSING, preset: MISSING.preset })

    render(<ModelPicker selectedId={MISSING.presetId} />)

    expect(screen.getByRole('button', { name: /Model/ }).textContent).toContain(
      '[CU1] Gone Workflow',
    )
  })

  it('refetches the catalog on open and from the refresh button', async () => {
    useEntries([AVAILABLE])

    render(<ModelPicker />)
    openPicker()

    expect(mockRefresh).toHaveBeenCalledTimes(1)

    const refresh = screen.getByRole('button', { name: 'Refresh models' })

    await waitFor(() => {
      expect((refresh as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(refresh)

    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })
})

describe('custom model invalid rows', () => {
  it('shows an invalid reason as visible text without a hover', () => {
    useEntries([INVALID])

    render(<ModelPicker />)
    const dialog = openPicker()
    const invalid = within(dialog).getByRole('button', { name: /Broken Workflow/ })

    expect(within(invalid).getByText('This workflow cannot run in ComfyUI.')).toBeTruthy()
  })
})

describe('custom model price units', () => {
  it('labels a per-second price with / s and a per-run price with / run', () => {
    useEntries([
      entry({
        preset: customPreset('custom.cu1.second', 'Second Model'),
        perRun: 2,
        priceUnit: 'second',
      }),
      entry({ preset: customPreset('custom.cu1.run', 'Run Model'), perRun: 2 }),
    ])

    render(<ModelPicker />)
    const dialog = openPicker()

    expect(within(dialog).getByText('$2.00 / s')).toBeTruthy()
    expect(within(dialog).getByText('$2.00 / run')).toBeTruthy()
  })
})
