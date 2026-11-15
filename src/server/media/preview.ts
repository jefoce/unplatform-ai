import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

import { PREVIEW_MAX_WIDTH } from '@/core/constants'

import { probeMedia } from './ffmpeg'
import { extractPosterFrame } from './poster-frame'
import { encodeWebpUnderCap } from './webp-cap'

interface MakePreviewParams {
  id: string
  video: string
  out: string
}

/** First frame of the video, kept as the poster for a finished download. */
export async function makePreview(params: MakePreviewParams): Promise<string | undefined> {
  const { id, video, out } = params
  const frame = `${out}.tmp-${randomUUID()}.png`

  try {
    const probe = await probeMedia(video).catch(() => {
      return null
    })

    const width = Math.min(probe?.width ?? PREVIEW_MAX_WIDTH, PREVIEW_MAX_WIDTH)

    await extractPosterFrame({ videoPath: video, width, outPath: frame })

    const capped = await encodeWebpUnderCap({ input: frame, width })

    await fs.writeFile(out, capped.buffer)

    return `${id}.preview.webp`
  } catch (error) {
    console.error(`[unplatform-ai] preview failed for ${id}`, error)

    return undefined
  } finally {
    await fs.unlink(frame).catch(() => {})
  }
}
