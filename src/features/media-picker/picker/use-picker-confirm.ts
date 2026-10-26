'use client'

import { useCallback } from 'react'
import { isEmpty, isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'
import { linkFolderFile } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

import { closeMediaPicker, type PickerRequest } from './store'

interface UsePickerConfirmParams {
  request: PickerRequest
  activeFolder?: FolderItem
  activeTab: string
  selectedFolderRels: string[]
  onConfirmUploads: () => void
}

/** Confirms uploads, or links the picked folder files before committing them. */
export function usePickerConfirm(params: UsePickerConfirmParams) {
  const { request, activeFolder, activeTab, selectedFolderRels, onConfirmUploads } = params

  const linking = useAsyncAction(async (folder: FolderItem) => {
    try {
      const rels = selectedFolderRels.slice(0, request.max)

      const uploads = await Promise.all(
        rels.map((rel) => {
          return linkFolderFile({ folderId: folder.id, relPath: rel })
        }),
      )

      request.onPick(uploads)
      closeMediaPicker()
    } catch (error) {
      toastError(error)
    }
  })

  const handleConfirm = useCallback(() => {
    if (isNil(activeFolder) || activeTab === 'uploads') {
      onConfirmUploads()

      return
    }

    if (isEmpty(selectedFolderRels)) {
      return
    }

    void linking.run(activeFolder)
  }, [activeFolder, activeTab, linking, onConfirmUploads, selectedFolderRels])

  return { isAddingFolderFiles: linking.isRunning, handleConfirm }
}
