'use client'

import { isNil } from 'lodash-es'

import type { FolderItem, UploadItem } from '@/core/types'

import { FolderTab } from './FolderTab'
import type { PickerRequest } from './store'
import { UploadsTab } from './UploadsTab'
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
    onSelectUpload,
    onFolderNavigate: handleFolderNavigate,
    onToggleFolderFile: handleToggleFolderFile,
  } = props
  const handleSelectUpload = onSelectUpload
  const handleDeleted = selection.removeSelected
  const handlePickFile = foldersState.handlePickFile
  const handleUploaded = upload.handleUploaded
  const handleRetry = upload.queue.retry
  const handleDismiss = upload.queue.dismiss

  if (isNil(activeFolder) || activeTab === 'uploads') {
    return (
      <UploadsTab
        kinds={request.kinds}
        max={request.max}
        extensions={request.extensions}
        selected={selection.selected}
        onSelect={handleSelectUpload}
        onUploaded={handleUploaded}
        uploading={upload.queue.items}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
        onDeleted={handleDeleted}
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
      onPickFile={handlePickFile}
      onNavigate={handleFolderNavigate}
      onToggleFile={handleToggleFolderFile}
    />
  )
}
