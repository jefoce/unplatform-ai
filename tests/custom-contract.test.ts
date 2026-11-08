import { describe, expect, it } from 'vitest'

import type { CatalogEntrySource, ModelAvailability } from '../src/core/catalog'
import {
  CUSTOM_CHECK_TIMEOUT_MS,
  CUSTOM_IMAGE_MAX_WAIT_MS,
  CUSTOM_MISSING_KEEP_DAYS,
  CUSTOM_REF_TOTAL_SEC,
  ENDPOINT_HEALTH_MAX_AGE_MS,
} from '../src/core/constants'
import {
  ENDPOINT_HEALTH_STATES,
  type EndpointHealthState,
  type EndpointHealthStatus,
} from '../src/core/endpoints'
import {
  HISTORY_FACET_KINDS,
  type HistoryFacetKind,
  type HistoryFacets,
  type ModelFacet,
} from '../src/core/history-facets'
import { RESOLVED_TRANSPORTS, TRANSPORTS } from '../src/core/presets/common/transport'
import { IMAGE_FAMILIES } from '../src/core/presets/image/types'
import { VIDEO_FAMILIES } from '../src/core/presets/video/types'
import { PRICING_FORMULAS } from '../src/core/pricing/types'
import {
  PROVIDER_KIND_IDS,
  PROVIDER_KINDS,
  type ProviderInstance,
  type ProviderKind,
} from '../src/core/providers/types'
import {
  recordSource,
  type RecordSourcePreset,
  type RecordSourceRecord,
} from '../src/core/record-source'
import {
  CUSTOM_ENDPOINT_PRICING_MODES,
  type CustomEndpoint,
  type CustomEndpointFile,
  CustomEndpointFileSchema,
  type CustomEndpointLastHealth,
  CustomEndpointLastHealthSchema,
  type CustomEndpointPricing,
  type CustomEndpointPricingMode,
  CustomEndpointPricingSchema,
  CustomEndpointSchema,
} from '../src/core/schemas/custom-endpoint'
import { type RecordProgress, RecordProgressSchema } from '../src/core/schemas/generation-record'
import { type RecordSource, RecordSourceSchema } from '../src/core/schemas/record-source'
import { STATUS_HELP, STATUS_HELP_KEYS } from '../src/core/status-help'
import { HISTORY_FACETS_PATH } from '../src/lib/api/swr-keys'
import { instanceKind, listInstances } from '../src/server/providers/registry'

const ENDPOINT_BODY = {
  id: 'custom-1',
  label: 'My ComfyUI',
  badge: 'C1',
  baseUrl: 'http://127.0.0.1:8188',
}

describe('provider kinds', () => {
  it('keeps both kind ids and describes each kind', () => {
    expect(PROVIDER_KIND_IDS).toEqual(['openrouter', 'custom'])

    const kind: ProviderKind = PROVIDER_KINDS.custom

    expect(kind).toMatchObject({
      id: 'custom',
      title: 'ComfyUI',
      local: true,
      multiple: true,
      dynamic: true,
      video: true,
      image: true,
    })

    expect(PROVIDER_KINDS.openrouter).toMatchObject({
      multiple: false,
      dynamic: false,
      local: false,
    })
  })

  it('lists the static openrouter instance only', () => {
    const instances: readonly ProviderInstance[] = listInstances('openrouter')
    const instance = instances[0]

    expect(instance).toEqual({
      id: 'openrouter',
      kind: 'openrouter',
      label: 'OpenRouter',
      badge: null,
    })

    expect(listInstances('custom')).toEqual([])
    expect(instanceKind('openrouter')).toBe('openrouter')
  })
})

describe('shared value lists', () => {
  it('adds the custom family and the upload transport', () => {
    expect(VIDEO_FAMILIES).toContain('custom')
    expect(IMAGE_FAMILIES).toContain('custom')
    expect(RESOLVED_TRANSPORTS).toEqual(['base64', 'url', 'upload'])
    expect(TRANSPORTS).toEqual(['base64', 'url', 'upload', 'auto'])
    expect(PRICING_FORMULAS).toContain('perRun')
  })

  it('adds the custom status help rows', () => {
    expect(STATUS_HELP_KEYS).toContain('waiting_comfyui')
    expect(STATUS_HELP_KEYS).toContain('queued_n')
    expect(STATUS_HELP_KEYS).toContain('endpoint_unreachable')
    expect(STATUS_HELP.waiting_comfyui.label).toBe('Waiting for ComfyUI')
    expect(STATUS_HELP.queued_n.label).toBe('In queue, N ahead')
    expect(STATUS_HELP.endpoint_unreachable.label).toBe('ComfyUI offline, will resume')
  })

  it('keeps the custom constants', () => {
    expect({
      CUSTOM_CHECK_TIMEOUT_MS,
      CUSTOM_IMAGE_MAX_WAIT_MS,
      CUSTOM_MISSING_KEEP_DAYS,
      CUSTOM_REF_TOTAL_SEC,
      ENDPOINT_HEALTH_MAX_AGE_MS,
    }).toEqual({
      CUSTOM_CHECK_TIMEOUT_MS: 3000,
      CUSTOM_IMAGE_MAX_WAIT_MS: 900000,
      CUSTOM_MISSING_KEEP_DAYS: 30,
      CUSTOM_REF_TOTAL_SEC: 30,
      ENDPOINT_HEALTH_MAX_AGE_MS: 30000,
    })
  })
})

describe('custom endpoint schemas', () => {
  it('fills the endpoint defaults and rejects a long badge', () => {
    const endpoint: CustomEndpoint = CustomEndpointSchema.parse(ENDPOINT_BODY)

    expect(endpoint).toMatchObject({
      enabled: true,
      pricing: { mode: 'model', usd: 0 },
      instanceId: null,
      lastHealth: null,
    })

    expect(CustomEndpointSchema.safeParse({ ...ENDPOINT_BODY, badge: 'TOOLONG' }).success).toBe(
      false,
    )
  })

  it('fills the file defaults', () => {
    const file: CustomEndpointFile = CustomEndpointFileSchema.parse({
      endpoints: [ENDPOINT_BODY],
    })

    expect(file.version).toBe(1)
    expect(file.badgeCounter).toBe(0)
    expect(file.endpoints).toHaveLength(1)
  })

  it('keeps the pricing and health shapes', () => {
    expect(CUSTOM_ENDPOINT_PRICING_MODES).toEqual(['model', 'free', 'perRun', 'perSecond'])

    const mode: CustomEndpointPricingMode = 'perRun'
    const pricing: CustomEndpointPricing = CustomEndpointPricingSchema.parse({})

    const health: CustomEndpointLastHealth = CustomEndpointLastHealthSchema.parse({
      protocol: 1,
      serverVersion: '1.0.0',
      maxRunning: 1,
      lanAllowed: false,
      authRequired: false,
      checkedAt: '',
    })

    expect(mode).toBe('perRun')
    expect(pricing).toEqual({ mode: 'model', usd: 0 })
    expect(health.protocol).toBe(1)
  })
})

describe('record source', () => {
  it('validates a stored source', () => {
    const source: RecordSource = RecordSourceSchema.parse({
      kind: 'custom',
      instanceId: 'custom-1',
      badge: 'C1',
      presetTitle: 'Local Wan',
      workflowName: 'wan.json',
      endpointLabel: 'Home',
      local: true,
    })

    expect(source.kind).toBe('custom')
  })

  it('falls back to the static openrouter source', () => {
    const preset: RecordSourcePreset = { title: 'Wan 3.0' }
    const record: RecordSourceRecord = { provider: 'openrouter', preset }
    const fallback: RecordSource = recordSource(record)

    expect(fallback).toEqual({
      kind: 'openrouter',
      instanceId: 'openrouter',
      badge: null,
      presetTitle: 'Wan 3.0',
      workflowName: null,
      endpointLabel: null,
      local: false,
    })

    const explicit = RecordSourceSchema.parse({
      kind: 'custom',
      instanceId: 'custom-1',
      badge: 'C1',
      presetTitle: 'Local Wan',
      workflowName: null,
      endpointLabel: null,
      local: true,
    })

    expect(recordSource({ ...record, source: explicit })).toBe(explicit)
  })

  it('validates record progress', () => {
    const progress: RecordProgress = RecordProgressSchema.parse({
      percent: 50,
      queuePosition: null,
      waitingOn: 'comfyui_busy',
    })

    expect(progress.waitingOn).toBe('comfyui_busy')
  })
})

describe('health and facets', () => {
  it('keeps the endpoint health states', () => {
    expect(ENDPOINT_HEALTH_STATES).toEqual([
      'ok',
      'unreachable',
      'unauthorized',
      'forbidden',
      'protocol',
    ])

    const state: EndpointHealthState = { state: 'ok', checkedAt: '', message: null }
    const status: EndpointHealthStatus = state.state

    expect(status).toBe('ok')
  })

  it('keeps the history facet shape', () => {
    expect(HISTORY_FACET_KINDS).toEqual(['video', 'image'])
    expect(HISTORY_FACETS_PATH).toBe('/api/history/facets')

    const model: ModelFacet = {
      presetId: 'wan-3.0',
      title: 'Wan 3.0',
      badge: null,
      count: 1,
      lastAt: '',
    }

    const kind: HistoryFacetKind = 'video'
    const facets: HistoryFacets = { kind, models: [model], resolutions: [], aspects: [] }

    expect(facets.models).toHaveLength(1)
  })

  it('keeps the catalog availability and source fields', () => {
    const availability: ModelAvailability = { status: 'available', reason: null }

    const source: CatalogEntrySource = {
      kind: 'openrouter',
      instanceId: 'openrouter',
      badge: null,
      workflowName: null,
      local: false,
    }

    expect(availability.status).toBe('available')
    expect(source.kind).toBe('openrouter')
  })
})
