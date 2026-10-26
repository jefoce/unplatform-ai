'use client'

import { type CSSProperties, useMemo } from 'react'
import { Ban } from 'lucide-react'

import { SUBMIT_GRACE_MS } from '@/core/constants'
import { graceDelayMs } from '@/core/submit-state'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { PILL_CLASSES, PILL_COMPACT_CLASSES } from './status-tone'

interface GraceCancelProps {
  notBefore?: string
  seconds: number
  compact: boolean
  onCancel: () => void
}

/** Cancel pill that fades over the grace window captured on mount. */
export function GraceCancel(props: GraceCancelProps) {
  const { notBefore, seconds, compact: isCompact } = props

  const remainingMs = useMemo(() => {
    return graceDelayMs(notBefore)
  }, [notBefore])

  const style = {
    '--grace-start': Math.min(1, remainingMs / SUBMIT_GRACE_MS),
    animationDuration: `${remainingMs}ms`,
  } as CSSProperties

  return (
    <Tooltip
      content={`Sends to OpenRouter in ${seconds} s. Cancel now and nothing is sent or charged.`}
    >
      <button
        type="button"
        onClick={props.onCancel}
        style={style}
        className={cn(
          PILL_CLASSES,
          'ml-auto grace-fade text-fg transition-colors hover:bg-white/10 hover:opacity-100! focus-visible:opacity-100!',
          isCompact && PILL_COMPACT_CLASSES,
        )}
      >
        <Ban size={16} className="shrink-0" aria-hidden />
        <span className="min-w-0 truncate">Cancel</span>
      </button>
    </Tooltip>
  )
}
