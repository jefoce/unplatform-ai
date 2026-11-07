import { isNil } from 'lodash-es'

import type { CatalogEntry } from '../catalog'

interface PriceSourceInfo {
  local: boolean
}

/** A local model at 0 hides its price. An API model at 0 still shows "$0.00". */
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
