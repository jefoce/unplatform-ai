'use client'

import { isNil } from 'lodash-es'

import { Button } from '@/ui/Button'

import { ErrorDetailsPopover } from './ErrorDetailsPopover'
import type { StatusView } from './status-view'

interface FailedBodyProps {
  view: StatusView
}

/** Friendly title, hint and available recovery actions. Hidden under a 240 px tile. */
export function FailedBody(props: FailedBodyProps) {
  const { view } = props
  const { error } = view

  return (
    <div className="absolute inset-0 hidden flex-col items-center justify-center gap-3 px-6 pt-14 text-center @min-[240px]:flex">
      <p className="line-clamp-2 text-danger">{error?.title ?? view.help.label}</p>
      {!isNil(view.line) && <p className="line-clamp-3 text-sm text-fg-2">{view.line}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!isNil(view.onRetry) && (
          <Button size="sm" variant="outline" onClick={view.onRetry}>
            Retry download
          </Button>
        )}
        {!isNil(view.onRerun) && (
          <Button size="sm" variant="outline" onClick={view.onRerun}>
            Reuse
          </Button>
        )}
        {!isNil(error) && <ErrorDetailsPopover error={error} />}
      </div>
    </div>
  )
}
