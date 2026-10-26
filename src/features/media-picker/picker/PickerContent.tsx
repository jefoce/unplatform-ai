'use client'

import { isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'
import type { UploadItem } from '@/core/schemas/upload-item'

import { FolderTab } from '../folders/FolderTab'
import { UploadsTab } from '../uploads/UploadsTab'
import type { PickerRequest } from './store'
import type { PickerFolders } from './use-picker-folders'
import type { PickerSelection } from './use-picker-selection'
import type { PickerUpload } from './use-picker-upload'

interface PickerContentProps {
  request: PickerRequest
  activeTab: string
  activeFolder?: FolderItem
  selection: PickerSelection
  foldersState: PickerFolders
  upload: PickerUpload
  folderSub: string
  selectedFolderRels: string[]
  onSelectUpload: (item: UploadItem) => void
  onFolderNavigate: (next: string) => void
  onToggleFolderFile: (rel: string) => void
}

/** Uploads grid or folder browser for the active tab. */
export function PickerContent(props: PickerContentProps) {
  const {
    request,
    activeTab,
    activeFolder,
    selection,
    foldersState,
    upload,
    folderSub,
    selectedFolderRels,
  } = props

  const { retry, dismiss } = upload.queue
  const { removeSelected } = selection

  if (isNil(activeFolder) || activeTab === 'uploads') {
    return (
      <UploadsTab
        kinds={request.kinds}
        max={request.max}
        extensions={request.extensions}
        selected={selection.selected}
        onSelect={props.onSelectUpload}
        onUploaded={upload.handleUploaded}
        uploading={upload.queue.items}
        onRetry={retry}
        onDismiss={dismiss}
        onDeleted={removeSelected}
      />
    )
  }

  return (
    <FolderTab
      key={activeFolder.id}
      folderId={activeFolder.id}
      folderName={activeFolder.name}
      kinds={request.kinds}
      max={request.max}
      extensions={request.extensions}
      sub={folderSub}
      selectedRels={selectedFolderRels}
      onPickFile={foldersState.handlePickFile}
      onNavigate={props.onFolderNavigate}
      onToggleFile={props.onToggleFolderFile}
    />
  )
}
