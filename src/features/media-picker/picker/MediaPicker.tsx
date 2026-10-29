'use client'

import { isNil } from 'lodash-es'

import { DockedPanel } from '@/ui/DockedPanel'

import { pickerAnchor } from './anchors'
import { PickerBody } from './PickerBody'
import { closeMediaPicker, useMediaPickerStore } from './store'

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    closeMediaPicker()
  }
}

/** Picker shell, docked beside its opener on wide screens, a dialog otherwise. */
export function MediaPicker() {
  const request = useMediaPickerStore((state) => {
    return state.request
  })

  return (
    <DockedPanel
      open={!isNil(request)}
      onOpenChange={handleOpenChange}
      anchor={request?.anchor ?? pickerAnchor('generator')}
      fallback="modal"
      label="Choose media"
    >
      {!isNil(request) && <PickerBody key={request.id} request={request} />}
    </DockedPanel>
  )
}
