'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'

import type { FolderItem, UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/lib/platform'

import { deleteFolder, linkFolderFile } from './api'

interface UsePickerFoldersParams {
  activeTab: string
  folders: FolderItem[]
  onTabChange: (tab: string) => void
  onCommit: (items: UploadItem[]) => void
}

export interface PickerFolders {
  activeFolder?: FolderItem
  isBusy: boolean
  handleAdded: (folder: FolderItem) => void
  handleDisconnect: (folderId: string) => void
  handlePickFile: (rel: string) => void
}

/** Connected-folder state and actions for the picker body. */
export function usePickerFolders(params: UsePickerFoldersParams): PickerFolders {
  const { activeTab, folders, onTabChange, onCommit } = params
  const { mutate } = useSWRConfig()
  const [isBusy, setIsBusy] = useState(false)
  const activeFolder = folders.find((folder) => folder.id === activeTab)

  const handleAdded = useCallback(
    (folder: FolderItem) => {
      void mutate(['folders'])
      onTabChange(folder.id)
    },
    [mutate, onTabChange],
  )

  const handleDisconnectSync = useCallback(
    async (folderId: string) => {
      if (!(await platform.confirm('Disconnect this folder? Existing uploads stay.'))) return

      try {
        await deleteFolder(folderId)
        await mutate(['folders'])

        if (activeTab === folderId) onTabChange('uploads')
      } catch (error) {
        toast.error(errorMessage(error))
      }
    },
    [activeTab, mutate, onTabChange],
  )

  const handleDisconnect = useCallback(
    (folderId: string) => void handleDisconnectSync(folderId),
    [handleDisconnectSync],
  )

  const handleLinkFile = useCallback(
    async (folderId: string, relPath: string) => {
      setIsBusy(true)

      try {
        onCommit([await linkFolderFile({ folderId, relPath })])
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setIsBusy(false)
      }
    },
    [onCommit],
  )

  const handlePickFile = useCallback(
    (rel: string) => {
      if (!activeFolder) return

      void handleLinkFile(activeFolder.id, rel)
    },
    [activeFolder, handleLinkFile],
  )

  return { activeFolder, isBusy, handleAdded, handleDisconnect, handlePickFile }
}
