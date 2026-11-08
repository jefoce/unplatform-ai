'use client'

import { type SyntheticEvent, useEffect, useRef, useState } from 'react'
import { isFunction, isNil } from 'lodash-es'

import { cn } from '@/lib/cn'

type ImageFit = 'contain' | 'cover'

interface MediaImageProps {
  src: string
  alt: string
  fit: ImageFit
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}

const FIT_CLASSES = {
  contain: 'object-contain',
  cover: 'object-cover',
} satisfies Record<ImageFit, string>

/** Full image, faded in once the browser decodes it. */
export function MediaImage(props: MediaImageProps) {
  const { src, alt, fit } = props
  const imageRef = useRef<HTMLImageElement>(null)
  const [decodedSrc, setDecodedSrc] = useState<string>()
  const isDecoded = decodedSrc === src
  const fitClass = FIT_CLASSES[fit]
  const imageFade = { 'opacity-0': !isDecoded, 'opacity-100': isDecoded }

  useEffect(() => {
    const image = imageRef.current

    if (isNil(image)) {
      return
    }

    let isActive = true

    const markDecoded = () => {
      if (isActive) {
        setDecodedSrc(src)
      }
    }

    if (isFunction(image.decode)) {
      image.decode().then(markDecoded, markDecoded)

      return () => {
        isActive = false
      }
    }

    if (image.complete) {
      markDecoded()
    } else {
      image.addEventListener('load', markDecoded, { once: true })
    }

    return () => {
      isActive = false
    }
  }, [src])

  return (
    // eslint-disable-next-line @next/next/no-img-element -- full original, not a thumb
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      draggable={false}
      decoding="async"
      className={cn(
        'absolute inset-0 size-full rounded-[inherit] transition-opacity duration-150',
        fitClass,
        imageFade,
      )}
      onLoad={props.onLoad}
    />
  )
}
