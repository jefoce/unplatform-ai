import { isNil, uniqBy } from 'lodash-es'

import type { GenerationListResult } from '@/core/api/video'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { favoriteChangedSince } from '@/lib/favorite-epoch'
import { isNewerRecord } from '@/lib/newer-record'

/** Deduped records from every loaded history page. */
export const loadedRecords = (pages?: GenerationListResult[]): GenerationRecord[] => {
  return uniqBy(
    pages?.flatMap((page) => {
      return page.items
    }) ?? [],
    'id',
  )
}

interface PatchPageParams {
  page: GenerationListResult
  byId: Map<string, GenerationRecord>
  activeCount: number
  epoch: number
}

/** Replaces matching records in one page, keeping order, cursors and the polled count. */
export function patchPage(params: PatchPageParams): GenerationListResult {
  const { page, byId, activeCount, epoch } = params

  const canReplace = (id: string): boolean => {
    return !favoriteChangedSince(id, epoch)
  }

  const replacement = (item: GenerationRecord): GenerationRecord | undefined => {
    const polled = byId.get(item.id)

    if (isNil(polled) || !canReplace(item.id) || isNewerRecord(item, polled)) {
      return undefined
    }

    return polled
  }

  const hasMatch = page.items.some((item) => {
    return !isNil(replacement(item))
  })

  if (!hasMatch && page.activeCount === activeCount) {
    return page
  }

  let items = page.items

  if (hasMatch) {
    items = page.items.map((item) => {
      return replacement(item) ?? item
    })
  }

  return {
    ...page,
    activeCount,
    items,
  }
}

interface FavoriteFromHistoryPagesParams {
  pages: GenerationListResult[]
  recordId: string
}

/** First favorite for a record across loaded pages, undefined when absent. */
export function favoriteFromHistoryPages(
  params: FavoriteFromHistoryPagesParams,
): boolean | undefined {
  const { pages, recordId } = params

  for (const page of pages) {
    const record = page.items.find((item) => {
      return item.id === recordId
    })

    if (!isNil(record)) {
      return record.favorite
    }
  }

  return undefined
}

interface PatchHistoryFavoriteParams {
  pages: GenerationListResult[]
  recordId: string
  isFavorite: boolean
}

/** Sets one record favorite in loaded pages, without a refetch. */
export function patchHistoryFavorite(params: PatchHistoryFavoriteParams): GenerationListResult[] {
  const { pages, recordId, isFavorite } = params

  return pages.map((page) => {
    let isChanged = false

    const items = page.items.map((item) => {
      if (item.id !== recordId || item.favorite === isFavorite) {
        return item
      }

      isChanged = true

      return { ...item, favorite: isFavorite }
    })

    if (!isChanged) {
      return page
    }

    return { ...page, items }
  })
}
