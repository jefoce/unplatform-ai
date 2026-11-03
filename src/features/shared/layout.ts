import { IMAGE_GRID_GAP } from '@/core/constants'

/** Shared shell frame: the video panels and the image island sit inside it. */
export const SHELL_FRAME = 'mx-auto w-full max-w-480 px-4'

/** Island offset from the top edge (`pt-2`) and surface height (`h-12`), in px. */
export const IMAGE_ISLAND_TOP_PX = 8

const IMAGE_ISLAND_HEIGHT_PX = 48

/** Image feed top padding: island offset, island height and the first row gap. */
export const IMAGE_FEED_TOP_PADDING = IMAGE_ISLAND_TOP_PX + IMAGE_ISLAND_HEIGHT_PX + IMAGE_GRID_GAP
