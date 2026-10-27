'use client'

import { useCallback } from 'react'
import { useSWRConfig } from 'swr'

import type { FolderItem } from '@/core/schemas/folder-item'
import { deleteFolder } from '@/lib/api/folders'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

interface UsePickerFoldersParams {
  activeTab: string
  folders: FolderItem[]
  onTabChange: (tab: string) => void
}

export interface PickerFolders {
  activeFolder?: FolderItem
  handleAdded: (folder: FolderItem) => void
  handleDisconnect: (folderId: string) => void
}

/** Connected-folder state and actions for the picker body. */
export function usePickerFolders(params: UsePickerFoldersParams): PickerFolders {
  const { activeTab, folders, onTabChange } = params
  const { mutate } = useSWRConfig()

  const activeFolder = folders.find((folder) => {
    return folder.id === activeTab
  })

  const handleAdded = useCallback(
    (folder: FolderItem) => {
      void mutate(['folders'])
      onTabChange(folder.id)
    },
    [mutate, onTabChange],
  )

  const handleDisconnectSync = useCallback(
    async (folderId: string) => {
      if (!(await platform.confirm('Disconnect this folder? Existing uploads stay.'))) {
        return
      }

      try {
        await deleteFolder(folderId)
        await mutate(['folders'])

        if (activeTab === folderId) {
          onTabChange('uploads')
        }
      } catch (error) {
        toastError(error)
      }
    },
    [activeTab, mutate, onTabChange],
  )

  const handleDisconnect = useCallback(
    (folderId: string) => {
      return void handleDisconnectSync(folderId)
    },
    [handleDisconnectSync],
  )

  return { activeFolder, handleAdded, handleDisconnect }
}
