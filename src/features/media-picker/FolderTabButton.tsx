'use client'

import { useCallback } from 'react'
import { X } from 'lucide-react'
import type { MouseEvent } from 'react'

import type { FolderItem } from '@/core/types'
import { cn } from '@/lib/cn'

import { tabClass } from './tab-class'

interface FolderTabButtonProps {
  folder: FolderItem
  isActive: boolean
  onTabChange: (tab: string) => void
  onDisconnectFolder: (folderId: string) => void
}

/** Folder tab with its disconnect control. */
export function FolderTabButton(props: FolderTabButtonProps) {
  const { folder, isActive, onTabChange, onDisconnectFolder } = props
  const handleSelect = useCallback(() => onTabChange(folder.id), [folder.id, onTabChange])
  const handleDisconnect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onDisconnectFolder(folder.id)
    },
    [folder.id, onDisconnectFolder],
  )

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className={cn(tabClass(isActive), 'max-w-40 pr-8')}
        onClick={handleSelect}
      >
        <span className="truncate">{folder.name}</span>
      </button>
      <button
        type="button"
        aria-label={`Disconnect ${folder.name}`}
        onClick={handleDisconnect}
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded-sm p-1 text-fg-2 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
