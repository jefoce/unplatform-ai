'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { isNil } from 'lodash-es'

import { thumbUrl } from '@/lib/api/media-urls'
import { preloadPosters } from '@/lib/preload-posters'
import { useChainKeys } from '@/lib/use-chain-keys'
import { MediaStage } from '@/ui/MediaStage'
import { Modal } from '@/ui/Modal'

import {
  type ActionKey,
  closePreview,
  type PreviewItem,
  type PreviewRequest,
  usePreviewStore,
} from './preview-store'
import { PreviewBody } from './PreviewBody'
import { PreviewFooter } from './PreviewFooter'
import { PreviewHeader } from './PreviewHeader'

/** 64 px thumb the stage blurs behind an image or video, undefined otherwise. */
function previewBodyKey(item: PreviewItem | undefined): string {
  return item?.id ?? 'none'
}

function stagePoster(item: PreviewItem | undefined): string | undefined {
  if (isNil(item) || item.missing === true) {
    return undefined
  }

  if (item.kind !== 'image' && item.kind !== 'video') {
    return undefined
  }

  const ref = item.previewRef ?? `uploads/${item.id}`

  return thumbUrl({ ref, w: 64 })
}

function stageBackdrop(item: PreviewItem | undefined, poster: string | undefined) {
  if (isNil(poster)) {
    return { kind: 'gradient' as const, seed: item?.id ?? 'missing' }
  }

  return { kind: 'image' as const, src: poster }
}

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    closePreview()
  }
}

interface PreviewToolbarParams {
  request: PreviewRequest
  item: PreviewItem | undefined
  render: ((item: PreviewItem) => ReactNode) | undefined
}

/** Toolbar node for the current item, null when the opener opts out or it is missing. */
function previewToolbar(params: PreviewToolbarParams): ReactNode {
  const { request, item, render } = params

  if (isNil(render) || isNil(item) || item.missing === true || request.allowUse === false) {
    return null
  }

  return render(item)
}

interface RunPreviewActionParams {
  request: PreviewRequest | null
  item: PreviewItem | undefined
  key: ActionKey
  onRefresh: () => void
}

/**
 * Select and deselect refresh after the opener commits its selection.
 * They close only without a true return, every other action closes before it runs.
 */
function runPreviewAction(params: RunPreviewActionParams): void {
  const { request, item, key, onRefresh } = params
  const action = request?.actions?.[key]

  if (!action || !item) {
    return
  }

  if (key === 'select' || key === 'deselect') {
    const isKeepOpen = action(item) === true

    onRefresh()

    if (!isKeepOpen) {
      closePreview()
    }

    return
  }

  closePreview()
  action(item)
}

/** Refreshes after the opener effect commits its latest selection. */
function useSelectionRefresh(): () => void {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (count === 0) {
      return
    }

    usePreviewStore.getState().refresh()
  }, [count])

  const requestRefresh = () => {
    setCount((current) => {
      return current + 1
    })
  }

  return requestRefresh
}

interface MediaPreviewModalProps {
  toolbar?: (item: PreviewItem) => ReactNode
}

/** Full-size media preview with header, navigation and opener actions. */
export function MediaPreviewModal(props: MediaPreviewModalProps) {
  const { toolbar: renderToolbar } = props

  const request = usePreviewStore((state) => {
    return state.request
  })

  const version = usePreviewStore((state) => {
    return state.version
  })

  const [lastRequest, setLastRequest] = useState(request)
  const [index, setIndex] = useState(request?.index ?? 0)
  const scopeRef = useRef<HTMLDivElement>(null)

  if (request !== lastRequest) {
    setLastRequest(request)
    setIndex(request?.index ?? 0)
  }

  const items = request?.items ?? []
  const item = items.at(index)
  const playerId = item ? `preview:${item.id}` : ''
  const bodyKey = previewBodyKey(item)

  useEffect(() => {
    const list = request?.items ?? []

    preloadPosters([stagePoster(list[index - 1]), stagePoster(list[index + 1])])
  }, [index, request])

  const backdropPoster = stagePoster(item)

  const requestRefresh = useSelectionRefresh()

  const handleRun = (key: ActionKey) => {
    runPreviewAction({ request, item, key, onRefresh: requestRefresh })
  }

  const handlePrev = useCallback(() => {
    setIndex((current) => {
      return Math.max(0, current - 1)
    })
  }, [])

  const handleNext = useCallback(() => {
    setIndex((current) => {
      return Math.min(items.length - 1, current + 1)
    })
  }, [items.length])

  useChainKeys({ isEnabled: !isNil(request), onPrevious: handlePrev, onNext: handleNext, scopeRef })

  if (!request) {
    return null
  }

  const toolbar = previewToolbar({ request, item, render: renderToolbar })

  return (
    <Modal
      open
      onOpenChange={handleOpenChange}
      label="Media preview"
      backdropClassName="bg-black/80"
      showClose
      className="flex h-[calc(100vh-48px)] max-h-275 w-[calc(100vw-48px)] max-w-450 flex-col overflow-hidden bg-page-2 p-0"
    >
      <div ref={scopeRef} className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <PreviewHeader item={item} actions={request.actions} />

        <MediaStage
          backdrop={stageBackdrop(item, backdropPoster)}
          toolbar={toolbar}
          nav={{
            hasPrevious: index > 0,
            hasNext: index < items.length - 1,
            onPrevious: handlePrev,
            onNext: handleNext,
          }}
        >
          <PreviewBody
            key={bodyKey}
            item={item}
            playerId={playerId}
            seekKeys="shiftArrows"
            autoPlay
          />
        </MediaStage>

        <PreviewFooter key={version} item={item} actions={request.actions} onRun={handleRun} />
      </div>
    </Modal>
  )
}
