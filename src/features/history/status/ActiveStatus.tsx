'use client'

import { isNil } from 'lodash-es'

import { GraceCancel } from './GraceCancel'
import type { StatusView } from './status-view'
import { StatusPill } from './StatusPill'

interface ActiveStatusProps {
  view: StatusView
  canCancel: boolean
  graceSeconds: number
}

/** Active card: pill and optional grace cancel. */
export function ActiveStatus(props: ActiveStatusProps) {
  const { view, canCancel, graceSeconds } = props

  return (
    <div className="absolute inset-x-4 top-4 z-10 flex flex-col gap-3 @max-[239px]:inset-x-3 @max-[239px]:top-3">
      <div className="flex flex-wrap items-start gap-2 @max-[239px]:gap-1.5">
        <StatusPill label={view.label} help={view.help} tone={view.tone} />

        {canCancel && !isNil(view.onCancel) && (
          <GraceCancel
            key={view.graceNotBefore}
            notBefore={view.graceNotBefore}
            seconds={graceSeconds}
            onCancel={view.onCancel}
          />
        )}
      </div>
    </div>
  )
}
