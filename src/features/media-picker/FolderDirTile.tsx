'use client'

import { useCallback } from 'react'
import { Folder } from 'lucide-react'

import type { FolderDir } from '@/core/types'

interface FolderDirTileProps {
  dir: FolderDir
  onNavigate: (rel: string) => void
}

/** Directory tile in the folder grid. */
export function FolderDirTile(props: FolderDirTileProps) {
  const { dir, onNavigate } = props
  const handleSelect = useCallback(() => onNavigate(dir.rel), [dir.rel, onNavigate])

  return (
    <button
      type="button"
      onClick={handleSelect}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg bg-surface-2 px-2 text-fg-2 transition hover:bg-white/10"
    >
      <Folder className="size-6" aria-hidden />
      <span className="max-w-full truncate text-xs text-fg">{dir.name}</span>
    </button>
  )
}
