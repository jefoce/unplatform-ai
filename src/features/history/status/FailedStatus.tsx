'use client'

import { FailedBody } from './FailedBody'
import { FailedPill } from './FailedPill'
import type { StatusView } from './status-view'

interface FailedStatusProps {
  view: StatusView
}

/** Failed card: pill in the corner, reason and actions in the middle. */
export function FailedStatus(props: FailedStatusProps) {
  const { view } = props

  return (
    <>
      <FailedPill view={view} />
      <FailedBody view={view} />
    </>
  )
}
