'use client'

import { Folder } from 'lucide-react'

import type { BrowseDir } from '@/core/media-types'

export interface DirectoryButtonProps {
  dir: BrowseDir
  onNavigate: (path: string) => void
}

/** Directory row in the add-folder browser. */
export function DirectoryButton(props: DirectoryButtonProps) {
  const { dir } = props

  const handleSelect = () => {
    props.onNavigate(dir.path)
  }

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
