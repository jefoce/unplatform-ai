import { DOCKED_PANEL_WIDTH } from '@/core/constants'

/** Ring shared by picked tiles in the media picker. */
export const SELECTED_TILE_CLASSES = 'ring-2 ring-accent ring-offset-2 ring-offset-surface'

/** Grid shared by every picker tab. */
export const PICKER_GRID_CLASSES = 'grid content-start justify-center gap-3 p-3'

/** Must match the gap in `PICKER_GRID_CLASSES`, used for row windowing. */
export const PICKER_GRID_GAP = 12

/** Panel border plus `p-2` and grid `p-3` on both sides. */
const PICKER_GRID_INSET = 2 * (1 + 8 + 12)

/** One card size across both pickers, from the four columns of the video panel. */
export const PICKER_TILE_PX = (DOCKED_PANEL_WIDTH - PICKER_GRID_INSET - 3 * PICKER_GRID_GAP) / 4

/** Grid columns shared by every picker tab. */
export const PICKER_GRID_STYLE = {
  gridTemplateColumns: `repeat(auto-fill, ${PICKER_TILE_PX}px)`,
}

/** Columns that fit a measured grid content width. */
export function pickerColumns(width: number): number {
  return Math.max(1, Math.floor((width + PICKER_GRID_GAP) / (PICKER_TILE_PX + PICKER_GRID_GAP)))
}

/** Square tile shared by picker uploads and generation outputs. */
export const PICKER_TILE_CLASSES =
  'group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface'
