'use client'

import { useCallback } from 'react'
import { Folder } from 'lucide-react'

export interface DirectoryButtonProps {
  dir: { name: string; path: string }
  onNavigate: (path: string) => void
}

/** Directory row in the add-folder browser. */
export function DirectoryButton(props: DirectoryButtonProps) {
  const { dir, onNavigate } = props
  const handleSelect = useCallback(() => onNavigate(dir.path), [dir.path, onNavigate])

  return (
    <button
      type="button"
      onClick={handleSelect}
      className="flex h-10 w-full items-center gap-2 truncate rounded-lg px-2 text-left text-sm transition hover:bg-white/5"
    >
      <Folder className="size-4 shrink-0 text-fg-2" aria-hidden />
      <span className="truncate">{dir.name}</span>
    </button>
  )
}
