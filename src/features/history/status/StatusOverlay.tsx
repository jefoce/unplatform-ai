'use client'

import { isNil } from 'lodash-es'
import type { ReactNode } from 'react'

import { graceDelayMs } from '@/core/submit-state'
import { cn } from '@/lib/cn'
import { useNow } from '@/lib/use-now'

import { ActiveStatus } from './ActiveStatus'
import { FailedStatus } from './FailedStatus'
import { GlowLayers } from './GlowLayers'
import type { StatusView } from './status-view'

function menuLayer(menu: ReactNode | undefined) {
  if (isNil(menu)) {
    return null
  }

  return <div className="absolute top-3 right-3 z-20">{menu}</div>
}

function progressLayer(percent: number | undefined) {
  if (isNil(percent)) {
    return null
  }

  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
      <div
        className="h-full bg-accent transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

interface StatusOverlayProps {
  view: StatusView
  boxAspect?: string
  fill?: boolean
  className?: string
  menu?: ReactNode
}

/** Placeholder for non-completed tiles: status pill, glow, timer and cost. */
export function StatusOverlay(props: StatusOverlayProps) {
  const { view, boxAspect, fill: isFill = false } = props

  const now = useNow(view.isLive === true)
  const remainingMs = graceDelayMs(view.graceNotBefore, now)
  const graceSeconds = Math.ceil(remainingMs / 1000)
  const canCancel = remainingMs > 0 && !isNil(view.onCancel)
  const aspectStyle = { aspectRatio: boxAspect ?? view.aspect ?? '1 / 1', margin: '0 auto' }
  const boxStyle = isFill ? undefined : aspectStyle

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-surface',
        isFill && 'h-full w-full',
        props.className,
      )}
      style={boxStyle}
    >
      <GlowLayers tone={view.tone} />

      {view.tone === 'red' && <FailedStatus view={view} />}
      {view.tone !== 'red' && (
        <ActiveStatus view={view} canCancel={canCancel} graceSeconds={graceSeconds} />
      )}
      {menuLayer(props.menu)}
      {progressLayer(view.progressPercent)}
    </div>
  )
}
