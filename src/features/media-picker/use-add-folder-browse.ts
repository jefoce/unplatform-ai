'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { BrowseResult } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { browseDirs } from './api'

export interface AddFolderBrowse {
  path: string | null
  data: BrowseResult | null
  isHidden: boolean
  navigate: (path: string) => void
  navigateRoot: () => void
  navigateParent: () => void
  reset: () => void
  toggleHidden: (isChecked: boolean) => void
}

/** Directory listing state for the add-folder dialog. */
export function useAddFolderBrowse(isOpen: boolean): AddFolderBrowse {
  const [path, setPath] = useState<string | null>(null)
  const [data, setData] = useState<BrowseResult | null>(null)
  const [isHidden, setIsHidden] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!isOpen) return

    let isAlive = true

    browseDirs(path ?? undefined, isHidden)
      .then((result) => isAlive && setData(result))
      .catch((error) => isAlive && toast.error(errorMessage(error)))

    return () => {
      isAlive = false
    }
  }, [isOpen, path, isHidden, reload])

  const navigate = useCallback((next: string) => {
    setData(null)
    setPath(next)
    setReload((value) => value + 1)
  }, [])

  const navigateRoot = useCallback(() => navigate('/'), [navigate])
  const navigateParent = useCallback(() => navigate(data?.parent ?? '/'), [data?.parent, navigate])

  const reset = useCallback(() => {
    setPath(null)
    setData(null)
  }, [])

  const toggleHidden = useCallback((isChecked: boolean) => {
    setData(null)
    setIsHidden(isChecked)
  }, [])

  return { path, data, isHidden, navigate, navigateRoot, navigateParent, reset, toggleHidden }
}
