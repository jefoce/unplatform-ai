'use client'

import { useCallback, useState } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { FolderItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { linkFolderFile } from './api'
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
  const [isAddingFolderFiles, setIsAddingFolderFiles] = useState(false)

  const handleConfirm = useCallback(async () => {
    if (isNil(activeFolder) || activeTab === 'uploads') {
      onConfirmUploads()

      return
    }

    if (isEmpty(selectedFolderRels)) return

    setIsAddingFolderFiles(true)

    try {
      const rels = selectedFolderRels.slice(0, request.max)
      const uploads = await Promise.all(
        rels.map((rel) => linkFolderFile({ folderId: activeFolder.id, relPath: rel })),
      )

      request.onPick(uploads)
      closeMediaPicker()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsAddingFolderFiles(false)
    }
  }, [activeFolder, activeTab, selectedFolderRels, onConfirmUploads, request])

  return { isAddingFolderFiles, handleConfirm }
}
