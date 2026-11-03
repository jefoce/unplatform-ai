import { isNil } from 'lodash-es'

import type { ExportResult } from '@/core/api/export'
import type {
  BatchResult,
  GenerationBatchBody,
  GenerationEstimate,
  GenerationListResult,
} from '@/core/api/video'
import { HISTORY_PAGE_SIZE } from '@/core/constants'
import { FILTER_PARAMS } from '@/core/feed/history-filters'
import { isNonEmptyString } from '@/core/guards'
import type { ReferencePlan } from '@/core/media/media-types'
import type { GenerationInput, GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { HistoryFilters } from '@/core/types'
import type { GenerationEstimateKey } from '@/lib/api/swr-keys'
import { apiDelete, apiPatch, apiPost, fetcher } from '@/lib/fetcher'

import { type QueryParams, withQuery } from './query'

export function createGeneration(input: GenerationInput): Promise<GenerationRecord> {
  return apiPost<GenerationRecord>('/api/generations', input)
}

export function fetchEstimate(key: GenerationEstimateKey): Promise<GenerationEstimate> {
  const [url, json] = key
  const parsed: unknown = JSON.parse(json)

  return apiPost<GenerationEstimate>(url, parsed)
}

export function cancelGenerationRequest(id: string): Promise<void> {
  return apiPost<void>(`/api/generations/${id}/cancel`)
}

export function retryDownloadRequest(id: string): Promise<void> {
  return apiPost<void>(`/api/generations/${id}/download`)
}

export function setFavorite(id: string, isFavorite: boolean): Promise<GenerationRecord> {
  return apiPatch<GenerationRecord>(`/api/generations/${id}`, { favorite: isFavorite })
}

export function batchGenerations(ids: string[], body: GenerationBatchBody): Promise<BatchResult> {
  return apiPost<BatchResult>('/api/generations/batch', { ...body, ids })
}

interface ExportRecordParams {
  id: string
  path: string
}

export function exportRecord(params: ExportRecordParams): Promise<void> {
  const { id, path } = params

  return apiPost<void>(`/api/generations/${id}/export`, { path })
}

interface ExportBatchParams {
  ids: string[]
  dir: string
}

export function exportBatch(params: ExportBatchParams): Promise<ExportResult> {
  const { ids, dir } = params

  return apiPost<ExportResult>('/api/generations/export-batch', { ids, dir })
}

export function fetchUploadsByIds(ids: string[]): Promise<UploadItem[]> {
  return fetcher<UploadItem[]>(`/api/uploads?ids=${ids.map(encodeURIComponent).join(',')}`)
}

/** History list URL for the current filters, identical for every page. */
function historyKey(filters: HistoryFilters): string {
  const query = filters.q?.trim()
  const params: QueryParams = { limit: HISTORY_PAGE_SIZE }

  if (isNonEmptyString(query)) {
    params.q = query
  }

  if (filters.favorite === true) {
    params.favorite = '1'
  }

  for (const [key, fallback] of FILTER_PARAMS) {
    const value = filters[key]

    if (isNonEmptyString(value) && value !== fallback) {
      params[key] = value
    }
  }

  return withQuery('/api/generations', params)
}

interface GenerationPageKeyParams {
  filters: HistoryFilters
  index: number
  previous: GenerationListResult | null
}

/** SWR key for one history page, null when the previous page is the last one. */
export function generationPageKey(params: GenerationPageKeyParams): string | null {
  const { filters, index, previous } = params

  if (index > 0 && isNil(previous?.nextCursor)) {
    return null
  }

  const cursor = index > 0 ? previous?.nextCursor : undefined

  return withQuery(historyKey(filters), { cursor })
}

export function fetchGenerationPage(key: string): Promise<GenerationListResult> {
  return fetcher<GenerationListResult>(key)
}

export function fetchGenerationsByIds(ids: string[]): Promise<GenerationListResult> {
  return fetcher<GenerationListResult>(
    `/api/generations?ids=${ids.map(encodeURIComponent).join(',')}`,
  )
}

export function requestReferencePlan(presetId: string, ids: string[]): Promise<ReferencePlan> {
  return apiPost<ReferencePlan>('/api/references/plan', { presetId, ids })
}

export function deleteGeneration(id: string): Promise<void> {
  return apiDelete<void>(`/api/generations/${id}`)
}

export function captureGenerationFrame(id: string, at: 'first' | 'last'): Promise<UploadItem> {
  return apiPost<UploadItem>(`/api/generations/${id}/frame`, { at })
}

export function revealGeneration(id: string): Promise<void> {
  return apiPost<void>(`/api/generations/${id}/reveal`)
}
