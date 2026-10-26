'use client'

import { useCallback, useState } from 'react'

/** Selected folder files plus the current subdirectory, reset on tab change. */
export function useFolderBrowse(max: number) {
  const [selectedFolderRels, setSelectedFolderRels] = useState<string[]>([])
  const [folderSub, setFolderSub] = useState('')

  const handleReset = useCallback(() => {
    setSelectedFolderRels([])
    setFolderSub('')
  }, [])

  const handleNavigate = useCallback((next: string) => {
    setFolderSub(next)
    setSelectedFolderRels([])
  }, [])

  const handleToggleFile = useCallback(
    (rel: string) => {
      setSelectedFolderRels((previous) => {
        if (previous.includes(rel)) {
          return previous.filter((entry) => {
            return entry !== rel
          })
        }

        if (previous.length >= max) {
          return previous
        }

        return [...previous, rel]
      })
    },
    [max],
  )

  return { folderSub, selectedFolderRels, handleReset, handleNavigate, handleToggleFile }
}
