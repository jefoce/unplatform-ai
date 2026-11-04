import 'server-only'

import sharp from 'sharp'

import { MAX_IMAGE_PIXELS } from '@/core/constants'

import { createLimiter } from '../sync/limiter'

// One libvips pool for the whole server. Nothing here benefits from a disk cache.
sharp.cache(false)
sharp.concurrency(2)

/** Passed to every sharp call that reads user-supplied pixels. */
export const SHARP_INPUT_OPTIONS = { limitInputPixels: MAX_IMAGE_PIXELS } as const

/** One bounded queue for sharp work that does not already sit in a larger limiter. */
export const sharpQueue = createLimiter('sharpQueue', 2)

export default sharp
