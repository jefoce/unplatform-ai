import {
  Copy,
  Download,
  Film,
  FolderOpen,
  Frame,
  Hash,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'

import type { MenuEntry } from './MoreMenuContent'

export interface MenuActions {
  onRegenerate: () => void
  onReveal: () => void
  onDownload: () => void
  onReuse: () => void
  onRemove: () => void
  onCaptureLast: () => void
  onCaptureFirst: () => void
  onAddReference: () => void
  onCopyPrompt: () => void
  onCopySeed: () => void
}

interface MenuEntriesParams {
  isVideo: boolean
  isCompleted: boolean
  hasFullVideoRefs: boolean
  revealLabel: string
  actions: MenuActions
}

/** Regenerate, reveal, reuse and delete, plus the video frame and clipboard rows. */
export function menuEntries(params: MenuEntriesParams): MenuEntry[] {
  const { isVideo, isCompleted, hasFullVideoRefs, revealLabel, actions } = params
  const entries: MenuEntry[] = []

  if (isCompleted) {
    entries.push({
      key: 'regenerate',
      label: 'Regenerate',
      icon: <RefreshCw size={14} aria-hidden />,
      onSelect: actions.onRegenerate,
    })

    entries.push({
      key: 'reveal',
      label: revealLabel,
      icon: <FolderOpen size={14} aria-hidden />,
      onSelect: actions.onReveal,
    })

    if (!isVideo) {
      entries.push({
        key: 'download',
        label: 'Download',
        icon: <Download size={14} aria-hidden />,
        onSelect: actions.onDownload,
      })
    }
  }

  entries.push({
    key: 'reuse',
    label: 'Reuse prompt',
    icon: <RotateCcw size={14} aria-hidden />,
    onSelect: actions.onReuse,
  })

  if (isCompleted && isVideo) {
    entries.push({ key: 'frames-separator', separator: true })

    entries.push({
      key: 'capture-last',
      label: 'Use last frame as start frame',
      icon: <Frame size={14} aria-hidden />,
      onSelect: actions.onCaptureLast,
    })

    entries.push({
      key: 'capture-first',
      label: 'Use first frame as start frame',
      icon: <Frame size={14} aria-hidden />,
      onSelect: actions.onCaptureFirst,
    })

    entries.push({
      key: 'add-reference',
      label: 'Add video as reference',
      icon: <Film size={14} aria-hidden />,
      isDisabled: hasFullVideoRefs,
      onSelect: actions.onAddReference,
    })

    entries.push({ key: 'copy-separator', separator: true })

    entries.push({
      key: 'copy-prompt',
      label: 'Copy prompt',
      icon: <Copy size={14} aria-hidden />,
      onSelect: actions.onCopyPrompt,
    })

    entries.push({
      key: 'copy-seed',
      label: 'Copy seed',
      icon: <Hash size={14} aria-hidden />,
      onSelect: actions.onCopySeed,
    })
  }

  if (isCompleted || isVideo) {
    entries.push({ key: 'delete-separator', separator: true })
  }

  if (isCompleted || isVideo) {
    entries.push({
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 size={14} aria-hidden />,
      isDestructive: true,
      onSelect: actions.onRemove,
    })
  }

  return entries
}
