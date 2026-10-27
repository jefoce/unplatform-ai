'use client'

import { useState } from 'react'
import useSWR from 'swr'

import { fetchFolders } from '@/lib/api/folders'
import { useBoolean } from '@/lib/use-boolean'

import { AddFolderDialog } from '../folders/AddFolderDialog'
import { useFolderBrowse } from '../folders/use-folder-browse'
import { PickerContent } from './PickerContent'
import { PickerTabs } from './PickerTabs'
import { closeMediaPicker, type PickerRequest } from './store'
import { usePauseAudioOnUnmount } from './use-pause-audio'
import { usePickerFolders } from './use-picker-folders'
import { usePickerUpload } from './use-picker-upload'

interface PickerBodyProps {
  request: PickerRequest
}

/** Picker contents, remounted per request so state starts fresh. */
export function PickerBody(props: PickerBodyProps) {
  const { request } = props
  const [activeTab, setActiveTab] = useState('uploads')
  const folderBrowse = useFolderBrowse()

  const { folderSub, handleReset, handleNavigate } = folderBrowse

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    handleReset()
  }

  const { data: folders = [] } = useSWR(['folders'], fetchFolders)

  const foldersState = usePickerFolders({
    activeTab,
    folders,
    onTabChange: handleTabChange,
  })

  const upload = usePickerUpload({ request })
  const addFolderDialog = useBoolean()

  const handleAddOpenChange = (isOpen: boolean): void => {
    addFolderDialog.set(isOpen)
  }

  const activeFolder = foldersState.activeFolder

  usePauseAudioOnUnmount()

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <PickerTabs
          folders={folders}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddFolder={addFolderDialog.on}
          onClose={closeMediaPicker}
          onDisconnectFolder={foldersState.handleDisconnect}
        />

        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface/60">
          <PickerContent
            request={request}
            activeTab={activeTab}
            activeFolder={activeFolder}
            upload={upload}
            folderSub={folderSub}
            onFolderNavigate={handleNavigate}
          />
        </div>
      </div>

      <AddFolderDialog
        open={addFolderDialog.value}
        onOpenChange={handleAddOpenChange}
        onAdded={foldersState.handleAdded}
      />
    </>
  )
}
