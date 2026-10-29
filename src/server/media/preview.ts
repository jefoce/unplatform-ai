import 'server-only'

import { PREVIEW_WIDTH } from '@/core/constants'

import { extractPosterFrame } from './poster-frame'

interface MakePreviewParams {
  id: string
  video: string
  out: string
}

/** First frame of the video, kept as the poster for a finished download. */
export async function makePreview(params: MakePreviewParams): Promise<string | undefined> {
  const { id, video, out } = params

  try {
    await extractPosterFrame({
      videoPath: video,
      width: PREVIEW_WIDTH,
      outPath: out,
    })

    return `${id}.preview.png`
  } catch (error) {
    console.error(`[unplatform-ai] preview failed for ${id}`, error)

    return undefined
  }
}
