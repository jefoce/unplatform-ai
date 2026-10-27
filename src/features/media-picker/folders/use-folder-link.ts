'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'

import { folderFileUpload } from '@/core/folder-match'
import type { UploadsById } from '@/core/schemas/upload-item'
import { linkFolderFile } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'
import type { LatestRef } from '@/lib/use-latest'

import type { PickerMode } from '../picker/store'
import { applyPicked } from './folder-tab-helpers'

interface UseFolderLinkParams {
  folderId: string
  folderPath: string
  mode: PickerMode
  selectedIds: LatestRef<string[]>
  uploadsById: LatestRef<UploadsById>
}

export interface FolderLink {
  linkingRel: string | null
  handleSelectFile: (rel: string) => void
}

/** Links folder files once and toggles the existing upload on later clicks. */
export function useFolderLink(params: UseFolderLinkParams): FolderLink {
  const { folderId, folderPath, mode, selectedIds, uploadsById } = params
  const [linkingRel, setLinkingRel] = useState<string | null>(null)

  const linking = useAsyncAction(async (rel: string) => {
    setLinkingRel(rel)

    try {
      const upload = await linkFolderFile({ folderId, relPath: rel })

      applyPicked(mode, upload)
    } catch (error) {
      toastError(error)
    } finally {
      setLinkingRel(null)
    }
  })

  const handleSelectFile = (rel: string): void => {
    const attached = folderFileUpload({
      folderPath,
      rel,
      selectedIds: selectedIds.current,
      uploadsById: uploadsById.current,
    })

    if (mode.kind === 'toggle' && !isNil(attached)) {
      mode.onToggle(attached)

      return
    }

    void linking.run(rel)
  }

  return { linkingRel, handleSelectFile }
}
