import type { RecordKind } from '@/core/feed/grid-item'

import type { HistoryView } from './view-store'

type RadiusByKind = Record<RecordKind, string>

/** Corner radius by view and record kind: masonry is square for both kinds. */
export const TILE_RADIUS = {
  list: { image: 'rounded-none', video: 'rounded-2xl' },
  grid: { image: 'rounded-none', video: 'rounded-2xl' },
  masonry: { image: 'rounded-none', video: 'rounded-none' },
} satisfies Record<HistoryView, RadiusByKind>
