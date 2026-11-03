import type { PresetIcon } from '../presets/common/icon'

/** Model picker row shared by the video and image presets. */
export interface PickerModel {
  id: string
  title: string
  icon: PresetIcon
  description: string
  priceText: string
}
