'use client'

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isNil } from 'lodash-es'

import type { Dict } from '@/core/utility-types'
import { canHandleDialogKey } from '@/lib/dialog-keys'

import { type DragState, paintOffset } from './use-zoom-pan'
import { cancelFrame } from './zoom-frame'
import { EMPTY_VIEW, FIT_ZOOM, KEY_STEP, type ZoomState, zoomTo, type ZoomView } from './zoom-math'

interface UseZoomInputParams {
  layerRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  dragRef: RefObject<DragState | undefined>
  view: ZoomView
  zoom: ZoomState
  maxScale: number
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

interface TestWindow {
  __zoomRenders?: number
}

const WHEEL_STEP = 1.1
const PINCH_FACTOR = 0.01
const WHEEL_COMMIT_MS = 120

type TimerId = ReturnType<typeof setTimeout>

const KEY_STEPS: Dict<number> = {
  '0': 0,
  '+': KEY_STEP,
  '=': KEY_STEP,
  '-': 1 / KEY_STEP,
}

/** Test-only render count, enabled when the e2e harness installed its helper. */
function countZoomRender(): void {
  if (typeof window === 'undefined' || !('__e2e' in window)) {
    return
  }

  const testWindow = window as Window & TestWindow

  testWindow.__zoomRenders = (testWindow.__zoomRenders ?? 0) + 1
}

/** Counts one ZoomLayer render per commit while the e2e harness is attached. */
export function useZoomRenderCount(): void {
  useEffect(() => {
    countZoomRender()
  })
}

function wheelFactor(event: WheelEvent): number {
  if (event.ctrlKey) {
    return Math.exp(-event.deltaY * PINCH_FACTOR)
  }

  if (event.deltaY < 0) {
    return WHEEL_STEP
  }

  return 1 / WHEEL_STEP
}

interface CommitWheelParams {
  previewRef: RefObject<ZoomState | undefined>
  timerRef: RefObject<TimerId | undefined>
  setZoom: Dispatch<SetStateAction<ZoomState>>
}

/** Commits the previewed wheel zoom once the wheel goes quiet. */
function scheduleWheelCommit(params: CommitWheelParams): void {
  const { previewRef, timerRef, setZoom } = params

  if (!isNil(timerRef.current)) {
    clearTimeout(timerRef.current)
  }

  timerRef.current = setTimeout(() => {
    timerRef.current = undefined
    const preview = previewRef.current

    previewRef.current = undefined

    if (!isNil(preview)) {
      setZoom(preview)
    }
  }, WHEEL_COMMIT_MS)
}

/** Layer refs plus the measured content box, refreshed when either side resizes. */
export function useZoomView(resetKey: string) {
  const layerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ZoomView>(EMPTY_VIEW)

  useEffect(() => {
    const layer = layerRef.current
    const content = contentRef.current?.firstElementChild

    if (isNil(layer) || !(content instanceof HTMLElement)) {
      return
    }

    const measure = () => {
      setView({
        layerWidth: layer.offsetWidth,
        layerHeight: layer.offsetHeight,
        contentLeft: content.offsetLeft,
        contentTop: content.offsetTop,
        contentWidth: content.offsetWidth,
        contentHeight: content.offsetHeight,
      })
    }

    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(layer)
    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [resetKey])

  return { layerRef, contentRef, view }
}

/** Wheel and keyboard zoom, with wheel painted per frame and committed once quiet. */
export function useZoomInput(params: UseZoomInputParams): void {
  const { layerRef, contentRef, dragRef, view, zoom, maxScale, setZoom } = params
  const previewRef = useRef<ZoomState | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)
  const timerRef = useRef<TimerId | undefined>(undefined)

  useEffect(() => {
    const layer = layerRef.current

    if (isNil(layer)) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      if (!isNil(dragRef.current)) {
        return
      }

      const rect = layer.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const current = previewRef.current ?? zoom

      previewRef.current = zoomTo({
        view,
        current,
        nextScale: current.scale * wheelFactor(event),
        point,
        maxScale,
        isAnimated: false,
      })

      if (isNil(frameRef.current)) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = undefined
          const preview = previewRef.current

          if (!isNil(preview)) {
            paintOffset({ contentRef, view, scale: preview.scale, offset: preview.offset })
          }
        })
      }

      scheduleWheelCommit({ previewRef, timerRef, setZoom })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const step = KEY_STEPS[event.key]

      if (!canHandleDialogKey(event, layer) || isNil(step)) {
        return
      }

      event.preventDefault()

      if (step === 0) {
        setZoom(FIT_ZOOM)

        return
      }

      const point = { x: view.layerWidth / 2, y: view.layerHeight / 2 }

      setZoom((current) => {
        return zoomTo({
          view,
          current,
          nextScale: current.scale * step,
          point,
          maxScale,
          isAnimated: true,
        })
      })
    }

    layer.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      layer.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)

      cancelFrame(frameRef)

      if (!isNil(timerRef.current)) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [contentRef, dragRef, layerRef, maxScale, setZoom, view, zoom])
}
