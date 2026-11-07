'use client'

import { isNil } from 'lodash-es'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { getPreset } from '@/core/presets'
import { cn } from '@/lib/cn'
import {
  type HistoryItem,
  type ImageGridItem,
  isVideoItem,
  type VideoGridItem,
} from '@/lib/feed/output-items'
import { revealLabel } from '@/lib/platform/reveal-label'
import { useBoolean } from '@/lib/use-boolean'

import { isCustomActiveRecord } from '../status/status-tone'
import { ROUND_BUTTON_CLASSES } from './card-action-styles'
import { DeleteConfirm } from './DeleteConfirm'
import { menuEntries } from './menu-entries'
import { MenuTrigger } from './MenuTrigger'
import { MoreMenuContent } from './MoreMenuContent'
import { cancelInGrace, stopInComfyUI } from './record-menu-actions'
import { regenerateItem } from './regenerate-actions'
import { imageRegenerateDescription, videoRegenerateDescription } from './regenerate-confirm'
import { RegenerateDialog } from './RegenerateDialog'
import { deleteMenuItem, useMoreMenuActions } from './use-more-menu-actions'

function triggerClassOf(variant: 'overlay' | 'panel'): string {
  if (variant === 'panel') {
    return 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-2 transition hover:bg-hover'
  }

  return ROUND_BUTTON_CLASSES
}

interface MoreMenuProps {
  item: HistoryItem
  onDeleted?: () => void
  className?: string
  variant?: 'overlay' | 'panel'
}

interface DeleteCopy {
  label: string
  title: string
  description: string
}

function regenerateDescription(video: VideoGridItem | null, image: ImageGridItem | null): string {
  if (video) {
    return videoRegenerateDescription(video.source)
  }

  if (image) {
    return imageRegenerateDescription(image)
  }

  return ''
}

function deleteCopy(isVideo: boolean): DeleteCopy {
  if (isVideo) {
    return {
      label: 'Delete video',
      title: 'Delete video?',
      description: 'Delete this video and its files? This cannot be undone.',
    }
  }

  return {
    label: 'Delete image',
    title: 'Delete image?',
    description: 'Delete this image? The file is removed from your computer.',
  }
}

/** Record actions: frame capture, reference copy, clipboard, reveal, delete. */
export function MoreMenu(props: MoreMenuProps) {
  const { item, className, variant = 'overlay' } = props
  const confirmDialog = useBoolean()
  const regenerateDialog = useBoolean()
  const isVideo = isVideoItem(item)
  const video = isVideo ? item : null
  const image = isVideo ? null : item
  const isCompleted = video ? video.status === 'completed' : image?.output?.status === 'saved'
  const hasFullVideoRefs = !isNil(video) && getPreset(video.source.preset.id).references.video === 0
  let stop: (() => void) | null = null

  if (!isNil(video) && isCustomActiveRecord(video.source)) {
    stop = () => {
      void stopInComfyUI(video.source)
    }
  }

  const handleRemove = () => {
    if (video && cancelInGrace(video.source)) {
      return
    }

    confirmDialog.on()
  }

  const actions = useMoreMenuActions({
    video,
    image,
    onRegenerate: regenerateDialog.on,
    onRemove: handleRemove,
  })

  const entries = menuEntries({
    isVideo: !isNil(video),
    isCompleted,
    hasFullVideoRefs,
    revealLabel: revealLabel(),
    actions,
    stop,
  })

  const handleDelete = async () => {
    await deleteMenuItem({ video, image })
  }

  const handleRegenerateConfirm = async () => {
    await regenerateItem(item)
  }

  const triggerClass = triggerClassOf(variant)
  const copy = deleteCopy(!isNil(video))
  const description = regenerateDescription(video, image)

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <MenuTrigger className={cn(triggerClass, className)} />
        <MoreMenuContent entries={entries} />
      </DropdownMenuPrimitive.Root>
      <DeleteConfirm
        open={confirmDialog.value}
        onOpenChange={confirmDialog.set}
        label={copy.label}
        title={copy.title}
        description={copy.description}
        onConfirm={handleDelete}
        onDeleted={props.onDeleted}
      />
      <RegenerateDialog
        open={regenerateDialog.value}
        onOpenChange={regenerateDialog.set}
        description={description}
        onConfirm={handleRegenerateConfirm}
      />
    </>
  )
}
