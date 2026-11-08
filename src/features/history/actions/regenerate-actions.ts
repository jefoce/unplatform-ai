import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { inputForSubmit } from '@/core/normalize-input'
import { findPreset } from '@/core/presets'
import { isCustomPresetId } from '@/core/presets/custom'
import { findImagePreset } from '@/core/presets/image'
import { refreshCredits } from '@/lib/api/credits'
import { createGeneration } from '@/lib/api/generations'
import { createImage } from '@/lib/api/images'
import { type HistoryItem, isVideoItem } from '@/lib/feed/output-items'
import { refreshHistoryFeeds } from '@/lib/history-feed-refresh'
import { refreshImages } from '@/lib/image-feed-refresh'
import { toastError } from '@/lib/notify'

import { reuseImagePrompt } from './image-actions'
import { rerunRecord } from './record-actions'

function generatingMessage(count: number): string {
  if (count > 1) {
    return 'Generating images'
  }

  return 'Generating image'
}

/** Resubmits the item input as a new grace record, with a fresh estimate. */
export async function regenerateItem(item: HistoryItem): Promise<void> {
  try {
    if (isVideoItem(item)) {
      const presetId = item.source.input.presetId

      if (isCustomPresetId(presetId) && isNil(findPreset(presetId))) {
        await rerunRecord(item.source)

        return
      }

      await createGeneration(inputForSubmit(item.source.input))
      await Promise.all([refreshHistoryFeeds(), refreshCredits(true)])
      toast.success('Generation starts in 10s')

      return
    }

    let input = item.source.input

    if (isCustomPresetId(input.presetId) && isNil(findImagePreset(input.presetId))) {
      await reuseImagePrompt(item)

      return
    }

    if (item.source.seedLocked === false) {
      input = { ...input, seed: null }
    }

    await createImage(input)
    await Promise.all([refreshImages(), refreshCredits(true)])
    toast.success(generatingMessage(item.source.input.count))
  } catch (error) {
    toastError(error)
  }
}
