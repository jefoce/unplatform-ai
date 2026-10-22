'use client'

import { isNil } from 'lodash-es'

import { Modal } from '@/ui/Modal'

import { PickerBody } from './PickerBody'
import { closeMediaPicker, useMediaPickerStore } from './store'

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) closeMediaPicker()
}

/** Dialog shell, the body remounts per request so its state resets. */
export function MediaPickerModal() {
  const request = useMediaPickerStore((state) => state.request)

  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={handleOpenChange}
      label="Choose media"
      className="flex h-[min(720px,85vh)] max-h-none w-[min(900px,90vw)] flex-col bg-page-2 p-3 max-compact:w-[calc(100vw-16px)]"
    >
      {!isNil(request) && <PickerBody key={request.id} request={request} />}
    </Modal>
  )
}
