import type { ExportResult } from '@/core/api/export'
import type { ImageBatchBody, ImageListResult, ImageSubmitBody } from '@/core/api/image'
import type { BatchResult } from '@/core/api/video'
import type { PriceQuote } from '@/core/pricing/types'
import type { ImageRecord } from '@/core/schemas/image-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { ImageEstimateKey } from '@/lib/api/swr-keys'
import { apiDelete, apiPatch, apiPost, fetcher } from '@/lib/fetcher'

import { type QueryParams, withQuery } from './query'

export function createImage(input: ImageSubmitBody): Promise<ImageRecord> {
  return apiPost<ImageRecord>('/api/images', input)
}

interface ImagePageParams {
  cursor?: string
  favorite?: boolean
  ids?: string[]
  presetId?: string
  q?: string
}

/** URL for one image list page, identical for SWR and direct calls. */
export function imagePageKey(params: ImagePageParams): string {
  const { favorite: isFavorite, ids, ...rest } = params
  const query: QueryParams = { ...rest }

  if (isFavorite === true) {
    query.favorite = '1'
  }

  if (ids && ids.length > 0) {
    query.ids = ids.map(encodeURIComponent).join(',')
  }

  return withQuery('/api/images', query)
}

export function fetchImagePage(key: string): Promise<ImageListResult> {
  return fetcher<ImageListResult>(key)
}

export function fetchActiveImages(key: string): Promise<ImageListResult> {
  return fetcher<ImageListResult>(key)
}

export function fetchImageEstimate(key: ImageEstimateKey): Promise<PriceQuote> {
  const [url, json] = key
  const parsed: unknown = JSON.parse(json)

  return apiPost<PriceQuote>(url, parsed)
}

interface OutputParams {
  recordId: string
  outputId: string
}

interface OutputFavoriteParams extends OutputParams {
  favorite: boolean
}

export function setOutputFavorite(params: OutputFavoriteParams): Promise<ImageRecord> {
  const { recordId, outputId, favorite: isFavorite } = params

  return apiPatch<ImageRecord>(`/api/images/${recordId}/outputs/${outputId}`, {
    favorite: isFavorite,
  })
}

export function deleteImageOutput(params: OutputParams): Promise<void> {
  const { recordId, outputId } = params

  return apiDelete<void>(`/api/images/${recordId}/outputs/${outputId}`)
}

export function revealImageOutput(params: OutputParams): Promise<void> {
  return apiPost<void>(`/api/images/${params.recordId}/outputs/${params.outputId}/reveal`)
}

export function batchImageOutputs(body: ImageBatchBody): Promise<BatchResult> {
  return apiPost<BatchResult>('/api/images/batch', body)
}

interface ImageExportRef {
  recordId: string
  outputId: string
}

interface ImageExportBatchParams {
  outputs: ImageExportRef[]
  dir: string
}

/** Desktop: copies saved image outputs into one real folder. */
export function exportImageBatch(params: ImageExportBatchParams): Promise<ExportResult> {
  return apiPost<ExportResult>('/api/images/export-batch', params)
}

export function deleteImageRecord(id: string): Promise<void> {
  return apiDelete<void>(`/api/images/${id}`)
}

/** Cancels an image still inside the submit grace window. */
export function cancelImageRequest(id: string): Promise<void> {
  return apiPost<void>(`/api/images/${id}/cancel`)
}

/** Copies a saved image output into uploads so the video draft can use it. */
export function createImageOutputUpload(params: OutputParams): Promise<UploadItem> {
  const { recordId, outputId } = params

  return apiPost<UploadItem>(`/api/images/${recordId}/outputs/${outputId}/frame`)
}
