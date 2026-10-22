import { clamp, filter, isEmpty, isNil, orderBy } from 'lodash-es'

import { HISTORY_MAX_PAGE_SIZE, HISTORY_PAGE_SIZE } from './constants'
import {
  ACTIVE_STATUSES,
  type GenerationRecord,
  type HistoryFilters,
  type JobStatus,
} from './types'

type StatusFilter = NonNullable<HistoryFilters['status']>

const hasMedia = (input: GenerationRecord['input']): boolean =>
  !isEmpty(input.frames.start) || !isEmpty(input.frames.end) || !isEmpty(input.references)

const matchesStatus = (status: JobStatus, wanted: StatusFilter): boolean => {
  if (wanted === 'all') return true
  if (wanted === 'done') return status === 'completed'
  if (wanted === 'active') return ACTIVE_STATUSES.includes(status)
  return status === 'failed' || status === 'cancelled' || status === 'expired'
}

const activeMode = (filters: HistoryFilters): HistoryFilters['mode'] | null => {
  const mode = filters.mode

  if (isNil(mode) || mode === 'all') return null
  return mode
}

const matchesQuery = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  const q = filters.q?.trim().toLowerCase()

  if (isNil(q) || q === '') return true

  return `${record.input.prompt} ${record.preset.title}`.toLowerCase().includes(q)
}

const matchesModel = (record: GenerationRecord, filters: HistoryFilters): boolean =>
  isNil(filters.model) || filters.model === '' || record.input.presetId === filters.model

const matchesFavorite = (record: GenerationRecord, filters: HistoryFilters): boolean =>
  isNil(filters.favorite) || record.favorite === filters.favorite

const matchesStatusFilter = (record: GenerationRecord, filters: HistoryFilters): boolean =>
  isNil(filters.status) || matchesStatus(record.status, filters.status)

const matchesMode = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  const mode = activeMode(filters)

  if (mode === 'text') return !hasMedia(record.input)
  if (mode === 'frames') return Boolean(record.input.frames.start)
  if (mode === 'references') return record.input.references.length > 0
  return true
}

const matchesTab = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  if (!isNil(activeMode(filters))) return true

  const tab = filters.tab

  if (isNil(tab) || tab === 'all') return true
  return record.input.tab === tab
}

const matchesResolution = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  const resolution = filters.resolution

  if (isNil(resolution) || resolution === 'all') return true
  return record.input.resolution === resolution
}

const matchesAspect = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  const aspect = filters.aspect

  if (isNil(aspect) || aspect === 'all') return true
  return record.input.aspectRatio === aspect
}

const matchesAudio = (record: GenerationRecord, filters: HistoryFilters): boolean => {
  const audio = filters.audio

  if (isNil(audio) || audio === 'any') return true
  return record.input.audio === (audio === 'on')
}

const FILTER_CHECKS = [
  matchesQuery,
  matchesModel,
  matchesFavorite,
  matchesStatusFilter,
  matchesMode,
  matchesTab,
  matchesResolution,
  matchesAspect,
  matchesAudio,
]

export function applyFilters(
  records: GenerationRecord[],
  filters: HistoryFilters,
): GenerationRecord[] {
  return filter(records, (record) => FILTER_CHECKS.every((check) => check(record, filters)))
}

export function sortRecords(records: GenerationRecord[]): GenerationRecord[] {
  return orderBy(records, ['createdAt', 'id'], ['desc', 'desc'])
}

function parseCursor(cursor: string): { createdAt: string; id: string } {
  const sep = cursor.lastIndexOf('|')

  if (sep < 0) return { createdAt: cursor, id: '\uffff' }
  return { createdAt: cursor.slice(0, sep), id: cursor.slice(sep + 1) }
}

const isAfter = (record: GenerationRecord, cursor: { createdAt: string; id: string }): boolean =>
  record.createdAt < cursor.createdAt ||
  (record.createdAt === cursor.createdAt && record.id < cursor.id)

interface PaginateParams {
  records: GenerationRecord[]
  cursor: string | null
  limit: number
}

export function paginate(params: PaginateParams): {
  items: GenerationRecord[]
  nextCursor: string | null
} {
  const { records, cursor, limit } = params
  const truncatedLimit = Math.trunc(limit)
  const requestedSize =
    truncatedLimit === 0 || Number.isNaN(truncatedLimit) ? HISTORY_PAGE_SIZE : truncatedLimit

  const size = clamp(requestedSize, 1, HISTORY_MAX_PAGE_SIZE)
  const at = isNil(cursor) || cursor === '' ? null : parseCursor(cursor)
  const remaining = at ? records.filter((record) => isAfter(record, at)) : records
  const items = remaining.slice(0, size)
  const last = items.at(-1)
  const nextCursor = remaining.length > size && last ? `${last.createdAt}|${last.id}` : null

  return { items, nextCursor }
}

export function countActive(records: GenerationRecord[]): number {
  return filter(records, (record) => ACTIVE_STATUSES.includes(record.status)).length
}
