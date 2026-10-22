'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { BrowseResult, FolderItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { getPlatform } from '@/lib/platform'

import { createFolder } from './api'

interface UseFolderConnectParams {
  data: BrowseResult | null
  onAdded: (folder: FolderItem) => void
  onClose: () => void
}

export interface FolderConnect {
  isAdding: boolean
  isChoosing: boolean
  add: () => void
  chooseNative: () => void
}

/** Connect actions for the add-folder dialog. */
export function useFolderConnect(params: UseFolderConnectParams): FolderConnect {
  const { data, onAdded, onClose } = params
  const [isAdding, setIsAdding] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)

  const addFolder = useCallback(async () => {
    if (!data) return

    setIsAdding(true)

    try {
      const folder = await createFolder(data.path)

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsAdding(false)
    }
  }, [data, onAdded, onClose])

  const chooseFolder = useCallback(async () => {
    setIsChoosing(true)

    try {
      const folder = await (await getPlatform()).chooseFolder()

      if (!folder) return

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsChoosing(false)
    }
  }, [onAdded, onClose])

  const add = useCallback(() => void addFolder(), [addFolder])
  const chooseNative = useCallback(() => void chooseFolder(), [chooseFolder])

  return { isAdding, isChoosing, add, chooseNative }
}
