import 'server-only'

import { isEmpty, isNil } from 'lodash-es'

import type { HistoryFacetKind, HistoryFacets, ModelFacet } from '@/core/history-facets'
import { IMAGE_ASPECT_RATIOS, IMAGE_RESOLUTIONS } from '@/core/presets/image/types'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/core/presets/video/types'
import { recordSource } from '@/core/record-source'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'

import { globalState } from '../global-state'
import { getGeneration, listGenerations, onGenerationChange } from '../repos/generations'
import { getImage, listImages, onImageChange } from '../repos/images'
import type { JsonDirChange } from '../repos/json-dir-store'

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
  isLoaded: boolean
  isDirty: boolean
  changes: JsonDirChange[]
  pending: Promise<void> | null
}

interface FacetSource {
  list: () => Promise<FacetRecord[]>
  get: (id: string) => Promise<FacetRecord | null>
  subscribe: (listener: (change: JsonDirChange) => void) => () => void
}

interface FacetOrder {
  resolutions: readonly string[]
  aspects: readonly string[]
}

const FACET_ORDER: Record<HistoryFacetKind, FacetOrder> = {
  video: { resolutions: RESOLUTIONS, aspects: [...ASPECT_RATIOS, 'auto'] },
  image: { resolutions: IMAGE_RESOLUTIONS, aspects: [...IMAGE_ASPECT_RATIOS, 'auto'] },
}

const SOURCES: Record<HistoryFacetKind, FacetSource> = {
  video: { list: listGenerations, get: getGeneration, subscribe: onGenerationChange },
  image: { list: listImages, get: getImage, subscribe: onImageChange },
}

const indexes = globalState<Map<HistoryFacetKind, FacetIndex>>('historyFacetIndexes', () => {
  return new Map()
})

/**
 * Facets for one kind, built lazily on the first request because boot.ts is not owned here.
 * Later writes arrive through the store change listeners and the next read flushes them.
 */
export async function getHistoryFacets(kind: HistoryFacetKind): Promise<HistoryFacets> {
  const index = ensureIndex(kind)

  while (true) {
    schedule(index, kind)

    if (!isNil(index.pending)) {
      await index.pending

      continue
    }

    if (!index.isDirty) {
      return index.facets
    }

    index.facets = facetsFromRows(kind, index.rows.values())
    index.isDirty = false
  }
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
    isLoaded: false,
    isDirty: false,
    changes: [],
    pending: null,
  }

  indexes.set(kind, index)

  SOURCES[kind].subscribe((change) => {
    index.changes.push(change)
    schedule(index, kind)
  })

  return index
}

function emptyFacets(kind: HistoryFacetKind): HistoryFacets {
  return { kind, models: [], resolutions: [], aspects: [] }
}

function schedule(index: FacetIndex, kind: HistoryFacetKind): void {
  if (!isNil(index.pending)) {
    return
  }

  if (index.isLoaded && isEmpty(index.changes)) {
    return
  }

  index.pending = drain(index, kind).finally(() => {
    index.pending = null
  })
}

async function drain(index: FacetIndex, kind: HistoryFacetKind): Promise<void> {
  if (!index.isLoaded) {
    await loadAll(index, kind)
  }

  await drainChanges(index, kind)
}

async function drainChanges(index: FacetIndex, kind: HistoryFacetKind): Promise<void> {
  while (!isEmpty(index.changes)) {
    const changes = index.changes.splice(0)

    for (const change of changes) {
      if (change.kind === 'forget') {
        index.rows.delete(change.id)

        continue
      }

      const record = await SOURCES[kind].get(change.id)

      if (isNil(record)) {
        index.rows.delete(change.id)

        continue
      }

      index.rows.set(record.id, rowOf(record))
    }

    index.isDirty = true
  }
}

/** The only full read. Later writes reach the index through the change queue. */
async function loadAll(index: FacetIndex, kind: HistoryFacetKind): Promise<void> {
  const records = await SOURCES[kind].list()

  index.rows = new Map(
    records.map((record) => {
      return [record.id, rowOf(record)]
    }),
  )

  index.facets = facetsFromRows(kind, index.rows.values())
  index.isLoaded = true
  index.isDirty = false
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
