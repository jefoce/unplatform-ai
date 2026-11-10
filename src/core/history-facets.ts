export const HISTORY_FACET_KINDS = ['video', 'image'] as const

export type HistoryFacetKind = (typeof HISTORY_FACET_KINDS)[number]

export interface ModelFacet {
  presetId: string
  title: string
  badge: string | null
  count: number
  lastAt: string
}

export interface HistoryFacets {
  kind: HistoryFacetKind
  models: ModelFacet[]
  resolutions: string[]
  aspects: string[]
}
