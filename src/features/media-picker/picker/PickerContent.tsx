'use client'

import { isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'

import { FolderTab } from '../folders/FolderTab'
import { UploadsTab } from '../uploads/UploadsTab'
import { ImageGenerations } from './ImageGenerations'
import { LikedGenerations } from './LikedGenerations'
import { IMAGE_TAB_ID, LIKED_TAB_ID, VIDEO_TAB_ID } from './picker-tab-list'
import { pickerGenerations, type PickerRequest } from './store'
import type { PickerUpload } from './use-picker-upload'
import { VideoGenerations } from './VideoGenerations'

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

  if (!isNil(activeFolder)) {
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

  const modeKind = request.mode.kind

  if (activeTab === IMAGE_TAB_ID) {
    return <ImageGenerations favorite={false} modeKind={modeKind} output={request.output} />
  }

  if (activeTab === VIDEO_TAB_ID) {
    return <VideoGenerations favorite={false} modeKind={modeKind} output={request.output} />
  }

  if (activeTab === LIKED_TAB_ID) {
    const mode = pickerGenerations(request)

    if (mode === 'both') {
      return <LikedGenerations modeKind={modeKind} output={request.output} />
    }

    if (mode === 'image') {
      return <ImageGenerations favorite modeKind={modeKind} output={request.output} />
    }

    return <VideoGenerations favorite modeKind={modeKind} output={request.output} />
  }

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
