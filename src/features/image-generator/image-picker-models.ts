import type { PickerModel } from '@/core/feed/picker-model'
import { IMAGE_PRESETS } from '@/core/presets/image'
import { imagePickerModel } from '@/features/generator/model/image-picker-model'

/** Image rows for the shared model picker, priced from the cheapest option. */
export function imagePickerModels(): readonly PickerModel[] {
  return IMAGE_PRESETS.map((preset) => {
    return imagePickerModel(preset)
  })
}
