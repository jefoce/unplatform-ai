'use client'

import { isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'

import { FolderTab } from '../folders/FolderTab'
import { UploadsTab } from '../uploads/UploadsTab'
import type { PickerRequest } from './store'
import type { PickerUpload } from './use-picker-upload'

interface PickerContentProps {
  request: PickerRequest
  activeTab: string
  activeFolder?: FolderItem
  upload: PickerUpload
  folderSub: string
  onFolderNavigate: (next: string) => void
}

/** Uploads grid or folder browser for the active tab. */
export function PickerContent(props: PickerContentProps) {
  const { request, activeTab, activeFolder, upload, folderSub } = props

  const { retry, dismiss } = upload.queue

  if (isNil(activeFolder) || activeTab === 'uploads') {
    return (
      <UploadsTab
        kinds={request.kinds}
        extensions={request.extensions}
        mode={request.mode}
        onUploaded={upload.handleUploaded}
        uploading={upload.queue.items}
        onRetry={retry}
        onDismiss={dismiss}
      />
    )
  }

  return (
    <FolderTab
      key={activeFolder.id}
      folderId={activeFolder.id}
      folderPath={activeFolder.path}
      folderName={activeFolder.name}
      kinds={request.kinds}
      extensions={request.extensions}
      sub={folderSub}
      mode={request.mode}
      onNavigate={props.onFolderNavigate}
    />
  )
}
