export interface MasonryItem {
  id: string

  /** width / height */
  aspect: number
}

export interface MasonryRowItem extends MasonryItem {
  x: number
  width: number
  height: number
}

export interface MasonryRow {
  y: number
  height: number
  items: readonly MasonryRowItem[]
}

export interface JustifyRowsParams {
  items: readonly MasonryItem[]
  width: number
  cols: number
  gap: number
}
