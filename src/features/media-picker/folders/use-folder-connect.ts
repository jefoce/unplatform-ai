'use client'

import { toast } from 'sonner'

import type { BrowseResult } from '@/core/media-types'
import type { FolderItem } from '@/core/schemas/folder-item'
import { createFolder } from '@/lib/api/folders'
import { toastError } from '@/lib/notify'
import { getPlatform } from '@/lib/platform'
import { useAsyncAction } from '@/lib/use-async-action'

interface UseFolderConnectParams {
  data: BrowseResult | null
  onAdded: (folder: FolderItem) => void
  onClose: () => void
}

export interface FolderConnect {
  isAdding: boolean
  isChoosing: boolean
  add: () => Promise<void>
  chooseNative: () => Promise<void>
}

/** Connect actions for the add-folder dialog. */
export function useFolderConnect(params: UseFolderConnectParams): FolderConnect {
  const { data, onAdded, onClose } = params

  const adding = useAsyncAction(async () => {
    if (!data) {
      return
    }

    try {
      const folder = await createFolder(data.path)

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toastError(error)
    }
  })

  const choosing = useAsyncAction(async () => {
    try {
      const folder = await (await getPlatform()).chooseFolder()

      if (!folder) {
        return
      }

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toastError(error)
    }
  })

  return {
    isAdding: adding.isRunning,
    isChoosing: choosing.isRunning,
    add: adding.run,
    chooseNative: choosing.run,
  }
}
