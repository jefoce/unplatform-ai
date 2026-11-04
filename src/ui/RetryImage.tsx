'use client'

import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { isNil } from 'lodash-es'
import { Image as ImageIcon, Music, Video } from 'lucide-react'

import type { MediaKind } from '@/core/media/media-types'
import { withQuery } from '@/lib/api/query'
import { cn } from '@/lib/cn'

type TimerId = ReturnType<typeof setTimeout>

interface RetryStatus {
  src: string
  attempt: number
  isFailed: boolean
}

const PLACEHOLDER_ICONS = {
  image: ImageIcon,
  video: Video,
  audio: Music,
}

const RETRY_DELAYS_MS = [500, 1500, 3000, 6000, 10_000, 10_000] as const

interface RetryOnWakeParams {
  src: string
  attempt: number
  timer: RefObject<TimerId | null>
  setStatus: Dispatch<SetStateAction<RetryStatus>>
}

/** Fires a pending retry as soon as the window is visible and focused again. */
function useRetryOnWake(params: RetryOnWakeParams): void {
  const { src, attempt, timer, setStatus } = params

  useEffect(() => {
    const retryNow = () => {
      if (isNil(timer.current) || document.visibilityState !== 'visible') {
        return
      }

      clearTimeout(timer.current)
      timer.current = null
      setStatus({ src, attempt: attempt + 1, isFailed: false })
    }

    window.addEventListener('focus', retryNow)
    document.addEventListener('visibilitychange', retryNow)

    return () => {
      window.removeEventListener('focus', retryNow)
      document.removeEventListener('visibilitychange', retryNow)
    }
  }, [attempt, setStatus, src, timer])
}

interface RetryImageProps {
  src: string
  alt: string
  className?: string
  kind?: MediaKind
  placeholder?: ReactNode
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  draggable?: boolean
  'aria-hidden'?: boolean
}

/** Image that retries for about 30 s before handing over to a placeholder. */
export function RetryImage(props: RetryImageProps) {
  const {
    src,
    alt,
    className,
    kind = 'image',
    placeholder,
    loading,
    decoding,
    draggable: isDraggable,
    'aria-hidden': isAriaHidden,
  } = props

  const [status, setStatus] = useState<RetryStatus>({ src, attempt: 0, isFailed: false })
  const timer = useRef<TimerId | null>(null)
  const isCurrent = status.src === src
  const attempt = isCurrent ? status.attempt : 0
  const isFailed = isCurrent ? status.isFailed : false

  useEffect(() => {
    return () => {
      if (!isNil(timer.current)) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [src])

  useRetryOnWake({ src, attempt, timer, setStatus })

  const handleError = () => {
    const delay = RETRY_DELAYS_MS[attempt]

    if (isNil(delay)) {
      setStatus({ src, attempt, isFailed: true })

      return
    }

    if (!isNil(timer.current)) {
      clearTimeout(timer.current)
    }

    timer.current = setTimeout(() => {
      timer.current = null
      setStatus({ src, attempt: attempt + 1, isFailed: false })
    }, delay)
  }

  if (isFailed) {
    if (!isNil(placeholder)) {
      return placeholder
    }

    const PlaceholderIcon = PLACEHOLDER_ICONS[kind]

    return (
      <span className={cn('flex items-center justify-center text-fg-2', className)}>
        <PlaceholderIcon aria-hidden className="size-6" />
      </span>
    )
  }

  let imageSrc = src

  if (attempt > 0) {
    imageSrc = withQuery(src, { r: attempt })
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- posters are pre-sized thumbs
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      draggable={isDraggable}
      aria-hidden={isAriaHidden}
      onError={handleError}
    />
  )
}
