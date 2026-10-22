'use client'

import { useCallback } from 'react'
import { Plus, X } from 'lucide-react'

import type { FolderItem } from '@/core/types'

import { FolderTabButton } from './FolderTabButton'
import { tabClass } from './tab-class'

export interface PickerTabsProps {
  folders: FolderItem[]
  activeTab: string
  onTabChange: (tab: string) => void
  onAddFolder: () => void
  onDisconnectFolder: (folderId: string) => void
  onClose: () => void
}

/** Scrollable pill tabs for uploads and connected folders. */
export function PickerTabs(props: PickerTabsProps) {
  const {
    folders,
    activeTab,
    onTabChange: handleTabChange,
    onAddFolder: handleAddFolder,
    onDisconnectFolder: handleDisconnectFolder,
    onClose: handleClose,
  } = props
  const handleUploadsTab = useCallback(() => handleTabChange('uploads'), [handleTabChange])

  return (
    <div className="flex h-12 shrink-0 items-center gap-2">
      <div className="flex flex-1 scrollbar-none items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={tabClass(activeTab === 'uploads')}
          onClick={handleUploadsTab}
        >
          Uploads
        </button>

        {folders.map((folder) => (
          <FolderTabButton
            key={folder.id}
            folder={folder}
            isActive={activeTab === folder.id}
            onTabChange={handleTabChange}
            onDisconnectFolder={handleDisconnectFolder}
          />
        ))}

        <button
          type="button"
          onClick={handleAddFolder}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs text-fg-2 transition hover:bg-white/5 hover:text-fg"
        >
          <Plus className="size-4" />
          Add folder
        </button>
      </div>

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close picker"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-white/5 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
