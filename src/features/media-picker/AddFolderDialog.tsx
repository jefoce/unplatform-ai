'use client'

import { useCallback } from 'react'
import { X } from 'lucide-react'

import type { FolderItem } from '@/core/types'
import { Modal } from '@/ui/Modal'

import { AddFolderFooter } from './AddFolderFooter'
import { FolderBrowser } from './FolderBrowser'
import { useAddFolderBrowse } from './use-add-folder-browse'
import { useFolderConnect } from './use-folder-connect'

export interface AddFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (folder: FolderItem) => void
}

/** Server directory browser used to connect a folder. */
export function AddFolderDialog(props: AddFolderDialogProps) {
  const { open: isOpen, onOpenChange, onAdded } = props
  const browse = useAddFolderBrowse(isOpen)
  const { reset } = browse

  const handleOpenChange = useCallback(
    (isNext: boolean) => {
      if (!isNext) reset()

      onOpenChange(isNext)
    },
    [onOpenChange, reset],
  )

  const handleClose = useCallback(() => handleOpenChange(false), [handleOpenChange])
  const connect = useFolderConnect({ data: browse.data, onAdded, onClose: handleClose })
  const handleNavigate = browse.navigate
  const handleNavigateRoot = browse.navigateRoot
  const handleNavigateParent = browse.navigateParent
  const handleShowHidden = browse.toggleHidden
  const handleAdd = connect.add
  const handleChooseNative = connect.chooseNative

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Add folder"
      className="flex h-[min(560px,80vh)] max-h-none w-[min(600px,92vw)] flex-col rounded-2xl border border-line-strong bg-page-2 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg-2">Add folder</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="flex size-8 items-center justify-center rounded-full text-fg-2 transition hover:bg-white/5 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>

      <FolderBrowser
        path={browse.path}
        data={browse.data}
        onNavigate={handleNavigate}
        onNavigateRoot={handleNavigateRoot}
        onNavigateParent={handleNavigateParent}
      />

      <AddFolderFooter
        data={browse.data}
        isHidden={browse.isHidden}
        isAdding={connect.isAdding}
        isChoosing={connect.isChoosing}
        onAdd={handleAdd}
        onChooseNative={handleChooseNative}
        onClose={handleClose}
        onShowHidden={handleShowHidden}
      />
    </Modal>
  )
}
