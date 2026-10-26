'use client'

import { useCallback, useEffect, useState } from 'react'

import type { BrowseResult } from '@/core/media-types'
import { browseDirs } from '@/lib/api/folders'
import { toastError } from '@/lib/notify'
import { useBoolean } from '@/lib/use-boolean'

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
  const { value: isHidden, set: setIsHidden } = useBoolean()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let isAlive = true

    browseDirs(path ?? undefined, isHidden)
      .then((result) => {
        if (isAlive) {
          setData(result)
        }
      })
      .catch((error) => {
        if (isAlive) {
          toastError(error)
        }
      })

    return () => {
      isAlive = false
    }
  }, [isOpen, path, isHidden, reload])

  const navigate = useCallback((next: string) => {
    setData(null)
    setPath(next)

    setReload((value) => {
      return value + 1
    })
  }, [])

  const navigateRoot = useCallback(() => {
    navigate('/')
  }, [navigate])

  const navigateParent = useCallback(() => {
    navigate(data?.parent ?? '/')
  }, [data?.parent, navigate])

  const reset = useCallback(() => {
    setPath(null)
    setData(null)
  }, [])

  const toggleHidden = useCallback(
    (isChecked: boolean) => {
      setData(null)
      setIsHidden(isChecked)
    },
    [setIsHidden],
  )

  return { path, data, isHidden, navigate, navigateRoot, navigateParent, reset, toggleHidden }
}
