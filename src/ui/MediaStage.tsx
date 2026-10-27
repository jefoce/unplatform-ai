'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { stageGradient } from './stage-gradients'
import { StageNavButton } from './StageNavButton'

interface StageImageBackdrop {
  kind: 'image'
  src: string
}

interface StageGradientBackdrop {
  kind: 'gradient'
  seed: string
}

type StageBackdrop = StageImageBackdrop | StageGradientBackdrop

interface StageNav {
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
}

interface MediaStageProps {
  backdrop: StageBackdrop
  children: ReactNode
  nav?: StageNav
  toolbar?: ReactNode
}

/**
 * Media area with a blurred thumb or hashed gradient behind the content.
 * @public
 */
export function MediaStage(props: MediaStageProps) {
  const { backdrop, children, nav, toolbar } = props

  return (
    <div className="group/stage relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-0 -z-10">
        {backdrop.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element -- blurred thumb, not a content image
          <img
            src={backdrop.src}
            alt=""
            aria-hidden
            draggable={false}
            loading="lazy"
            className="size-full scale-110 object-cover opacity-70 blur-3xl saturate-150"
          />
        )}
        {backdrop.kind === 'gradient' && (
          <div aria-hidden className={cn('size-full', stageGradient(backdrop.seed))} />
        )}
      </div>

      <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />

      <div
        style={{ containerType: 'size' }}
        className="relative flex size-full min-h-0 items-center justify-center p-4"
      >
        {children}
      </div>

      {Boolean(toolbar) && (
        <div className="pointer-events-none absolute top-4 right-4 z-10 flex opacity-0 transition-opacity group-hover/stage:pointer-events-auto group-hover/stage:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 max-compact:right-16 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100">
          {toolbar}
        </div>
      )}

      {nav && (
        <>
          <StageNavButton
            side="left"
            disabled={!nav.hasPrevious}
            onClick={nav.onPrevious}
            revealOnHover
          />
          <StageNavButton side="right" disabled={!nav.hasNext} onClick={nav.onNext} revealOnHover />
        </>
      )}
    </div>
  )
}
