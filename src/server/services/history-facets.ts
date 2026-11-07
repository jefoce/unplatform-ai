import 'server-only'

import { isNil } from 'lodash-es'

import type { HistoryFacetKind, HistoryFacets, ModelFacet } from '@/core/history-facets'
import { IMAGE_ASPECT_RATIOS, IMAGE_RESOLUTIONS } from '@/core/presets/image/types'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/video/types'
import { recordSource } from '@/core/record-source'
import { type GenerationRecord, GenerationRecordSchema } from '@/core/schemas/generation-record'
import { type ImageRecord, ImageRecordSchema } from '@/core/schemas/image-record'

import { globalState } from '../global-state'
import { downloadPaths, DOWNLOADS_DIR, imageRecordPath, IMAGES_DIR } from '../paths'
import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'
import { jsonDirStore } from '../repos/json-dir-store'

type FacetRecord = GenerationRecord | ImageRecord

interface FacetRow {
  id: string
  presetId: string
  title: string
  badge: string | null
  lastAt: string
  resolution: string | null
  aspect: string
}

interface ModelGroup {
  presetId: string
  title: string
  badge: string | null
  count: number
  lastAt: string
  newestId: string
}

interface FacetIndex {
  rows: Map<string, FacetRow>
  facets: HistoryFacets
  dirty: boolean
  pending: Promise<void> | null
}

interface FacetSource {
  list: () => Promise<FacetRecord[]>
  subscribe: (listener: () => void) => () => void
}

interface FacetOrder {
  resolutions: readonly string[]
  aspects: readonly string[]
}

const FACET_ORDER: Record<HistoryFacetKind, FacetOrder> = {
  video: { resolutions: RESOLUTIONS, aspects: [...ASPECT_RATIOS, 'auto'] },
  image: { resolutions: IMAGE_RESOLUTIONS, aspects: [...IMAGE_ASPECT_RATIOS, 'auto'] },
}

/**
 * The repos keep their store private. This handle opens the same globalState slot,
 * so a repo write notifies this index too. Replace with a repo re-export once one exists.
 */
const videoStore = jsonDirStore<GenerationRecord>({
  key: 'generationIndex',
  dir: DOWNLOADS_DIR,
  fileOf: (id) => {
    return downloadPaths(id).json
  },
  schema: GenerationRecordSchema,
})

const imageStore = jsonDirStore<ImageRecord>({
  key: 'imageIndex',
  dir: IMAGES_DIR,
  fileOf: imageRecordPath,
  schema: ImageRecordSchema,
})

const SOURCES: Record<HistoryFacetKind, FacetSource> = {
  video: { list: listGenerations, subscribe: subscribeVideo },
  image: { list: listImages, subscribe: subscribeImage },
}

const indexes = globalState<Map<HistoryFacetKind, FacetIndex>>('historyFacetIndexes', () => {
  return new Map()
})

function subscribeVideo(listener: () => void): () => void {
  return videoStore.onChange(listener)
}

function subscribeImage(listener: () => void): () => void {
  return imageStore.onChange(listener)
}

/**
 * Facets for one kind, built lazily on the first request because boot.ts is not owned here.
 * Later writes arrive through the store change listeners and the next read flushes them.
 */
export async function getHistoryFacets(kind: HistoryFacetKind): Promise<HistoryFacets> {
  const index = ensureIndex(kind)

  schedule(index, kind)

  while (!isNil(index.pending)) {
    await index.pending
  }

  return index.facets
}

/** One pass over the records. Same aggregation the incremental index runs. */
export function buildHistoryFacets(
  kind: HistoryFacetKind,
  records: readonly FacetRecord[],
): HistoryFacets {
  return facetsFromRows(kind, records.map(rowOf))
}

function ensureIndex(kind: HistoryFacetKind): FacetIndex {
  const existing = indexes.get(kind)

  if (!isNil(existing)) {
    return existing
  }

  const index: FacetIndex = {
    rows: new Map(),
    facets: emptyFacets(kind),
    dirty: false,
    pending: null,
  }

  indexes.set(kind, index)

  SOURCES[kind].subscribe(() => {
    schedule(index, kind)
  })

  return index
}

function emptyFacets(kind: HistoryFacetKind): HistoryFacets {
  return { kind, models: [], resolutions: [], aspects: [] }
}

function schedule(index: FacetIndex, kind: HistoryFacetKind): void {
  index.dirty = true
  index.pending ??= drain(index, kind)
}

async function drain(index: FacetIndex, kind: HistoryFacetKind): Promise<void> {
  try {
    while (index.dirty) {
      index.dirty = false

      await syncKind(index, kind)
    }
  } finally {
    index.pending = null
  }
}

/** Replaces only the rows of records that changed, then re-aggregates. */
async function syncKind(index: FacetIndex, kind: HistoryFacetKind): Promise<void> {
  const records = await SOURCES[kind].list()

  const ids = new Set(
    records.map((record) => {
      return record.id
    }),
  )

  for (const record of records) {
    index.rows.set(record.id, rowOf(record))
  }

  for (const id of index.rows.keys()) {
    if (!ids.has(id)) {
      index.rows.delete(id)
    }
  }

  index.facets = facetsFromRows(kind, index.rows.values())
}

function rowOf(record: FacetRecord): FacetRow {
  const source = recordSource(record)

  return {
    id: record.id,
    presetId: record.input.presetId,
    title: source.presetTitle,
    badge: source.badge,
    lastAt: record.createdAt,
    resolution: record.input.resolution,
    aspect: record.input.aspectRatio,
  }
}

function facetsFromRows(kind: HistoryFacetKind, rows: Iterable<FacetRow>): HistoryFacets {
  const groups = new Map<string, ModelGroup>()
  const resolutions = new Set<string>()
  const aspects = new Set<string>()

  for (const row of rows) {
    const group = groups.get(row.presetId)

    if (isNil(group)) {
      groups.set(row.presetId, {
        presetId: row.presetId,
        title: row.title,
        badge: row.badge,
        count: 1,
        lastAt: row.lastAt,
        newestId: row.id,
      })
    } else {
      group.count += 1

      if (isNewest(row, group)) {
        group.title = row.title
        group.badge = row.badge
        group.lastAt = row.lastAt
        group.newestId = row.id
      }
    }

    if (!isNil(row.resolution)) {
      resolutions.add(row.resolution)
    }

    aspects.add(row.aspect)
  }

  return {
    kind,
    models: [...groups.values()].map(toModelFacet).sort(compareModels),
    resolutions: orderPresent(resolutions, FACET_ORDER[kind].resolutions),
    aspects: orderPresent(aspects, FACET_ORDER[kind].aspects),
  }
}

function isNewest(row: FacetRow, group: ModelGroup): boolean {
  if (row.lastAt > group.lastAt) {
    return true
  }

  if (row.lastAt < group.lastAt) {
    return false
  }

  return row.id < group.newestId
}

function toModelFacet(group: ModelGroup): ModelFacet {
  const { presetId, title, badge, count, lastAt } = group

  return { presetId, title, badge, count, lastAt }
}

/** Newest model first, then by preset id so equal timestamps stay stable. */
function compareModels(left: ModelFacet, right: ModelFacet): number {
  if (left.lastAt === right.lastAt) {
    return left.presetId.localeCompare(right.presetId)
  }

  if (left.lastAt < right.lastAt) {
    return 1
  }

  return -1
}

function orderPresent(present: Set<string>, order: readonly string[]): string[] {
  const known = order.filter((value) => {
    return present.has(value)
  })

  const extras = [...present]
    .filter((value) => {
      return !order.includes(value)
    })
    .sort()

  return [...known, ...extras]
}
