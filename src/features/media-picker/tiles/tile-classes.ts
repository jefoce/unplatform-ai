/** Ring shared by picked tiles in the media picker. */
export const SELECTED_TILE_CLASSES = 'ring-2 ring-accent ring-offset-2 ring-offset-surface'

/** Grid shared by every picker tab. */
export const PICKER_GRID_CLASSES = 'grid grid-cols-4 content-start gap-3 p-3'

/** Must match the gap in `PICKER_GRID_CLASSES`, used for row windowing. */
export const PICKER_GRID_GAP = 12

/** Square tile shared by picker uploads and generation outputs. */
export const PICKER_TILE_CLASSES =
  'group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface'
