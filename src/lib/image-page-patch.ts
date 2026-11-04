import { isEqual, isNil } from 'lodash-es'

import type { ImageListResult } from '@/core/api/image'
import type { ImageRecord } from '@/core/schemas/image-record'

import { favoriteChangedSince } from './favorite-epoch'
import { isNewerRecord } from './newer-record'

interface MergeRecordParams {
  local: ImageRecord
  polled: ImageRecord
  epoch: number
}

/** True when a poll changed nothing the feed can see. */
function isSameRecord(local: ImageRecord, polled: ImageRecord): boolean {
  if (isNil(local.updatedAt) || isNil(polled.updatedAt)) {
    return isEqual(local.status, polled.status) && isEqual(local.cost, polled.cost)
  }

  return local.updatedAt === polled.updatedAt
}

function hasFavoriteChange(polled: ImageRecord, epoch: number): boolean {
  return polled.outputs.some((output) => {
    return favoriteChangedSince(output.id, epoch)
  })
}

/** Keeps a favorite picked after the poll started, and the local record when nothing changed. */
function mergeRecord(params: MergeRecordParams): ImageRecord {
  const { local, polled, epoch } = params

  if (isNewerRecord(local, polled)) {
    return local
  }

  if (!hasFavoriteChange(polled, epoch) && isSameRecord(local, polled)) {
    return local
  }

  const outputs = polled.outputs.map((output) => {
    if (!favoriteChangedSince(output.id, epoch)) {
      return output
    }

    const localOutput = local.outputs.find((item) => {
      return item.id === output.id
    })

    if (localOutput?.status !== 'saved' || output.status !== 'saved') {
      return output
    }

    return { ...output, favorite: localOutput.favorite }
  })

  return { ...polled, outputs }
}

interface PatchImagePagesParams {
  pages: ImageListResult[]
  polled: ImageListResult
  epoch: number
}

/** Patches loaded pages by record id, keeping order, cursors and the polled active count. */
export function patchImagePages(params: PatchImagePagesParams): ImageListResult[] {
  const { pages, polled, epoch } = params

  if (pages.length === 0) {
    return pages
  }

  const byId = new Map(
    polled.items.map((record) => {
      return [record.id, record]
    }),
  )

  return pages.map((page, index) => {
    let isChanged = false

    const items = page.items.map((item) => {
      const next = byId.get(item.id)

      if (isNil(next)) {
        return item
      }

      const merged = mergeRecord({ local: item, polled: next, epoch })

      if (merged !== item) {
        isChanged = true
      }

      return merged
    })

    const activeCount = index === 0 ? polled.activeCount : page.activeCount

    if (!isChanged && activeCount === page.activeCount) {
      return page
    }

    const nextItems = isChanged ? items : page.items

    return { ...page, items: nextItems, activeCount }
  })
}

interface PatchFavoriteParams {
  pages: ImageListResult[]
  outputId: string
  favorite: boolean
}

interface FavoriteFromPagesParams {
  pages: ImageListResult[]
  outputId: string
}

/** First saved favorite for an output across loaded pages, undefined when absent. */
export function favoriteFromPages(params: FavoriteFromPagesParams): boolean | undefined {
  const { pages, outputId } = params

  for (const page of pages) {
    for (const record of page.items) {
      const output = record.outputs.find((item) => {
        return item.id === outputId && item.status === 'saved'
      })

      if (output?.status === 'saved') {
        return output.favorite
      }
    }
  }

  return undefined
}

/** Sets one saved output favorite in loaded pages, without a refetch. */
export function patchFavorite(params: PatchFavoriteParams): ImageListResult[] {
  const { pages, outputId, favorite: isFavorite } = params

  return pages.map((page) => {
    let isChanged = false

    const items = page.items.map((item) => {
      let isItemChanged = false

      const outputs = item.outputs.map((output) => {
        if (output.id !== outputId || output.status !== 'saved' || output.favorite === isFavorite) {
          return output
        }

        isItemChanged = true

        return { ...output, favorite: isFavorite }
      })

      if (!isItemChanged) {
        return item
      }

      isChanged = true

      return { ...item, outputs }
    })

    if (!isChanged) {
      return page
    }

    return { ...page, items }
  })
}
