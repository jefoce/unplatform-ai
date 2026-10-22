import 'server-only'

import sharp from 'sharp'

// One libvips pool for the whole server. Nothing here benefits from a disk cache.
sharp.cache(false)
sharp.concurrency(2)

export default sharp
