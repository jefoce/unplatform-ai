import 'server-only'

import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import type { GenerationRecord, RecordOutput } from '@/core/schemas/generation-record'

import { probeMedia } from '../media/ffmpeg'

interface BuildOutputParams {
  record: GenerationRecord
  video: string
  preview: string | undefined
}

/**
 * Stored output for a finished download.
 * A probe or stat failure drops the field, it does not fail the download.
 */
export async function buildOutput(params: BuildOutputParams): Promise<RecordOutput> {
  const { record, video, preview } = params

  const probe = await probeMedia(video).catch(() => {
    return null
  })

  const stat = await fs.stat(video).catch(() => {
    return null
  })

  const bytes = stat?.size

  const output: RecordOutput = {
    video: `${record.id}.mp4`,
  }

  if (!isNil(preview)) {
    output.preview = preview
  }

  if (!isNil(probe?.width)) {
    output.width = probe.width
  }

  if (!isNil(probe?.height)) {
    output.height = probe.height
  }

  if (!isNil(probe?.durationSec)) {
    output.durationSec = probe.durationSec
  }

  if (!isNil(bytes)) {
    output.bytes = bytes
  }

  return output
}
