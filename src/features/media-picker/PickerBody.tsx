'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'
import useSWR from 'swr'

import type { UploadItem } from '@/core/types'
import { pauseAudio } from '@/lib/audio-player'

import { AddFolderDialog } from './AddFolderDialog'
import { fetchFolders } from './api'
import { PickerContent } from './PickerContent'
import { PickerDropOverlay } from './PickerDropOverlay'
import { PickerFooter } from './PickerFooter'
import { PickerTabs } from './PickerTabs'
import { closeMediaPicker, type PickerRequest } from './store'
import { useFolderBrowse } from './use-folder-browse'
import { usePickerConfirm } from './use-picker-confirm'
import { usePickerFolders } from './use-picker-folders'
import { usePickerSelection } from './use-picker-selection'
import { usePickerUpload } from './use-picker-upload'

interface PickerBodyProps {
  request: PickerRequest
}

/** Picker contents, remounted per request so state starts fresh. */
export function PickerBody(props: PickerBodyProps) {
  const { request } = props
  const [activeTab, setActiveTab] = useState('uploads')
  const folderBrowse = useFolderBrowse(request.max)
  const { folderSub, selectedFolderRels, handleReset, handleNavigate, handleToggleFile } =
    folderBrowse
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab)
      handleReset()
    },
    [handleReset],
  )
  const handleClose = closeMediaPicker
  const selection = usePickerSelection(request)
  const { commit, confirm } = selection
  const { data: folders = [] } = useSWR(['folders'], fetchFolders)
  const foldersState = usePickerFolders({
    activeTab,
    folders,
    onTabChange: handleTabChange,
    onCommit: commit,
  })
  const upload = usePickerUpload({ request, onCommit: commit })
  const [isAddOpen, setIsAddOpen] = useState(false)
  const handleAddOpenChange = setIsAddOpen
  const handleAddFolderOpen = useCallback(() => setIsAddOpen(true), [])
  const handleSelectUpload = useCallback((item: UploadItem) => commit([item]), [commit])
  const handleAdded = foldersState.handleAdded
  const handleDisconnect = foldersState.handleDisconnect
  const activeFolder = foldersState.activeFolder
  const isFolderTab = !isNil(activeFolder) && activeTab !== 'uploads'
  const { isAddingFolderFiles, handleConfirm } = usePickerConfirm({
    request,
    activeFolder,
    activeTab,
    selectedFolderRels,
    onConfirmUploads: confirm,
  })

  useEffect(() => () => pauseAudio(), [])

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col" {...upload.dropProps}>
        <PickerTabs
          folders={folders}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddFolder={handleAddFolderOpen}
          onClose={handleClose}
          onDisconnectFolder={handleDisconnect}
        />

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
          <PickerContent
            request={request}
            activeTab={activeTab}
            activeFolder={activeFolder}
            selection={selection}
            foldersState={foldersState}
            upload={upload}
            folderSub={folderSub}
            selectedFolderRels={selectedFolderRels}
            onSelectUpload={handleSelectUpload}
            onFolderNavigate={handleNavigate}
            onToggleFolderFile={handleToggleFile}
          />
        </div>

        <PickerFooter
          max={request.max}
          selectedCount={isFolderTab ? selectedFolderRels.length : selection.selected.length}
          isBusy={foldersState.isBusy || isAddingFolderFiles}
          onConfirm={handleConfirm}
        />

        <PickerDropOverlay isDragging={upload.isDragging} />
      </div>

      <AddFolderDialog open={isAddOpen} onOpenChange={handleAddOpenChange} onAdded={handleAdded} />
    </>
  )
}
