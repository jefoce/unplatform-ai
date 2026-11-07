import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'

interface PriceSourceInfo {
  local: boolean
}

/** Local models at 0 show no price. API models at 0 still show "$0.00". */
export function showPrice(source: PriceSourceInfo, usd: number): boolean {
  return !source.local || usd > 0
}

/** Price visibility for a catalog entry, visible while the catalog loads. */
export function isPriceVisibleFor(entry: CatalogEntry | null, usd: number): boolean {
  if (isNil(entry)) {
    return true
  }

  return showPrice(entry.source, usd)
}
