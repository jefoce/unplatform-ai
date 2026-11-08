'use client'

import { isNil } from 'lodash-es'

import type {
  EndpointHealthView,
  EndpointInput,
  EndpointOverviewEntry,
  EndpointTestResult,
} from '@/core/api/endpoints'
import type {
  CustomEndpointLastHealth,
  CustomEndpointPricing,
} from '@/core/schemas/custom-endpoint'

const BADGE_PATTERN = /^[A-Z0-9]{1,4}$/

export interface EndpointRowDraft {
  key: string
  id: string | null
  label: string
  badge: string
  baseUrl: string
  enabled: boolean
  pricing: CustomEndpointPricing
  instanceId: string | null
  lastHealth: CustomEndpointLastHealth | null
  videoCount: number
  imageCount: number
  runningJobs: number
  status: EndpointHealthView
  tokenValue: string
  isTokenRemoved: boolean
  hasToken: boolean
  tokenHint: string | null
  isExpanded: boolean
  isRemoved: boolean
  isTesting: boolean
  test: EndpointTestResult | null
}

export interface EndpointRowPatch {
  label?: string
  badge?: string
  baseUrl?: string
  enabled?: boolean
  pricing?: CustomEndpointPricing
  instanceId?: string | null
  lastHealth?: CustomEndpointLastHealth | null
  videoCount?: number
  imageCount?: number
  runningJobs?: number
  status?: EndpointHealthView
  tokenValue?: string
  isTokenRemoved?: boolean
  isExpanded?: boolean
  isRemoved?: boolean
  test?: EndpointTestResult | null
}

export interface TestedEndpoint {
  baseUrl: string
  token: string | null | undefined
}

export interface EndpointsDraft {
  rows: EndpointRowDraft[]
  nextBadge: string
  isLoading: boolean
  isDirty: boolean
  isValid: boolean
  onAdd: () => void
  onChange: (key: string, patch: EndpointRowPatch) => void
  onTest: (key: string) => void
  onSave: () => Promise<void>
  reset: () => void
}

export function toRow(view: EndpointOverviewEntry): EndpointRowDraft {
  return {
    key: view.id,
    id: view.id,
    label: view.label,
    badge: view.badge,
    baseUrl: view.baseUrl,
    enabled: view.enabled,
    pricing: view.pricing,
    instanceId: view.instanceId,
    lastHealth: view.lastHealth,
    videoCount: view.videoCount,
    imageCount: view.imageCount,
    runningJobs: view.runningJobs,
    status: view.status,
    tokenValue: '',
    isTokenRemoved: false,
    hasToken: view.hasToken,
    tokenHint: view.tokenHint,
    isExpanded: false,
    isRemoved: false,
    isTesting: false,
    test: null,
  }
}

export function toInput(row: EndpointRowDraft): EndpointInput {
  const badge = row.badge.trim().toUpperCase()
  const badgeValue = badge === '' ? null : badge

  return {
    id: row.id,
    label: row.label.trim(),
    badge: badgeValue,
    baseUrl: row.baseUrl.trim(),
    enabled: row.enabled,
    pricing: row.pricing,
    instanceId: row.instanceId,
    lastHealth: row.lastHealth,
    token: tokenOf(row),
  }
}

export function tokenOf(row: EndpointRowDraft): string | null | undefined {
  if (row.isTokenRemoved) {
    return null
  }

  const value = row.tokenValue.trim()

  if (value === '') {
    return undefined
  }

  return value
}

export function badgeError(row: EndpointRowDraft, rows: EndpointRowDraft[]): string | null {
  const badge = row.badge.trim().toUpperCase()

  if (badge === '') {
    return 'Badge is required'
  }

  if (!BADGE_PATTERN.test(badge)) {
    return '1 to 4 uppercase letters or digits'
  }

  const isTaken = rows.some((item) => {
    return item.key !== row.key && !item.isRemoved && item.badge.trim().toUpperCase() === badge
  })

  if (isTaken) {
    return `Badge ${badge} is already used`
  }

  return null
}

export function urlError(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return 'URL is required'
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  const withScheme = hasScheme ? trimmed : `http://${trimmed}`

  try {
    const url = new URL(withScheme)
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'

    if (!isHttp) {
      return 'Use http or https'
    }

    return null
  } catch {
    return 'URL is not valid'
  }
}

export function nextFreeBadge(rows: EndpointRowDraft[], start: string): string {
  const taken = new Set(
    rows.flatMap((row) => {
      if (row.isRemoved) {
        return []
      }

      return [row.badge.trim().toUpperCase()]
    }),
  )

  const match = /^CU(\d+)$/.exec(start)
  let number = 1

  if (!isNil(match)) {
    number = Number(match[1])
  }

  while (taken.has(`CU${number}`)) {
    number += 1
  }

  return `CU${number}`
}

export function sameInstanceBadge(row: EndpointRowDraft, rows: EndpointRowDraft[]): string | null {
  if (isNil(row.instanceId)) {
    return null
  }

  const other = rows.find((item) => {
    return item.key !== row.key && !item.isRemoved && item.instanceId === row.instanceId
  })

  if (isNil(other)) {
    return null
  }

  if (other.badge.trim() === '') {
    return other.label
  }

  return other.badge
}

function isRowValid(row: EndpointRowDraft, rows: EndpointRowDraft[]): boolean {
  if (row.isRemoved) {
    return true
  }

  return (
    row.label.trim() !== '' &&
    isNil(urlError(row.baseUrl)) &&
    isNil(badgeError(row, rows)) &&
    Number.isFinite(row.pricing.usd)
  )
}

export function isDraftValid(rows: EndpointRowDraft[]): boolean {
  return rows.every((row) => {
    return isRowValid(row, rows)
  })
}

export function videoSummary(row: EndpointRowDraft): string {
  if (isNil(row.lastHealth)) {
    return row.baseUrl
  }

  const protocol = `upai/${row.lastHealth.protocol}`

  return `${row.baseUrl} · ${protocol} · ${row.videoCount} video, ${row.imageCount} image models`
}
