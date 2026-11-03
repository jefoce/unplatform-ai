import { pickerGenerations, type PickerRequest } from './store'

export interface PickerTabItem {
  value: string
  label: string
}

const UPLOADS_TAB_ID = 'uploads'

export const IMAGE_TAB_ID = 'image-generations'
export const VIDEO_TAB_ID = 'video-generations'
export const LIKED_TAB_ID = 'liked'

const UPLOADS_TAB: PickerTabItem = { value: UPLOADS_TAB_ID, label: 'Uploads' }
const IMAGE_TAB: PickerTabItem = { value: IMAGE_TAB_ID, label: 'Image generations' }
const VIDEO_TAB: PickerTabItem = { value: VIDEO_TAB_ID, label: 'Video generations' }
const LIKED_TAB: PickerTabItem = { value: LIKED_TAB_ID, label: 'Liked' }

/** Static tabs before the connected folders, only when outputs are selectable. */
export function pickerTabList(request: PickerRequest): PickerTabItem[] {
  if (!request.output) {
    return [UPLOADS_TAB]
  }

  const mode = pickerGenerations(request)

  if (mode === 'image') {
    return [UPLOADS_TAB, { ...IMAGE_TAB, label: 'Generations' }, LIKED_TAB]
  }

  if (mode === 'video') {
    return [UPLOADS_TAB, VIDEO_TAB, LIKED_TAB]
  }

  return [UPLOADS_TAB, IMAGE_TAB, VIDEO_TAB, LIKED_TAB]
}
