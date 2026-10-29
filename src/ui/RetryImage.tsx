'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { isNil } from 'lodash-es'
import { Image as ImageIcon, Music, Video } from 'lucide-react'

import type { MediaKind } from '@/core/media-types'
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

const RETRY_DELAY_MS = 500
const SECOND_RETRY_DELAY_MS = 1500

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

/** Image that retries twice before handing over to a placeholder. */
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

  const handleError = () => {
    if (attempt >= 2) {
      setStatus({ src, attempt, isFailed: true })

      return
    }

    if (!isNil(timer.current)) {
      clearTimeout(timer.current)
    }

    const delay = attempt === 0 ? RETRY_DELAY_MS : SECOND_RETRY_DELAY_MS

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
