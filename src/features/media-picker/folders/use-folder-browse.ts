'use client'

import { useCallback, useState } from 'react'

/** Current folder subdirectory, reset on tab change. */
export function useFolderBrowse() {
  const [folderSub, setFolderSub] = useState('')

  const handleReset = useCallback(() => {
    setFolderSub('')
  }, [])

  const handleNavigate = useCallback((next: string) => {
    setFolderSub(next)
  }, [])

  return { folderSub, handleReset, handleNavigate }
}
