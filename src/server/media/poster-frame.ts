import 'server-only'

import { PREVIEW_AT_SEC } from '@/core/constants'
import { messageOf } from '@/core/errors'

import { extractFrame } from './ffmpeg'

const ERROR_TAIL_CHARS = 600

interface ExtractPosterFrameParams {
  videoPath: string
  width: number
  outPath: string
}

/**
 * Poster frame at PREVIEW_AT_SEC, retrying at the start when the seek has none.
 * Short clips have nothing at the seek point, so their first frame is the poster.
 */
export async function extractPosterFrame(params: ExtractPosterFrameParams): Promise<void> {
  const { videoPath, width, outPath } = params

  try {
    await extractFrame({ videoPath, atSec: PREVIEW_AT_SEC, width, outPath })

    return
  } catch {
    // Seek past the end of a short clip, retry at the first frame.
  }

  try {
    await extractFrame({ videoPath, atSec: 0, width, outPath })
  } catch (error) {
    const tail = messageOf(error).slice(-ERROR_TAIL_CHARS)

    console.error('[unplatform-ai] poster frame failed', tail)

    throw error
  }
}
