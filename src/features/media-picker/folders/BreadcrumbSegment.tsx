'use client'

import { Fragment } from 'react'

interface BreadcrumbSegmentProps {
  label: string
  target: string
  isCurrent: boolean
  onNavigate: (sub: string) => void
}

/** One clickable sub-path segment. */
export function BreadcrumbSegment(props: BreadcrumbSegmentProps) {
  const { label, target, isCurrent } = props

  const handleSelect = () => {
    props.onNavigate(target)
  }

  const currentClass = isCurrent ? 'shrink-0 text-fg' : 'shrink-0 transition hover:text-fg'

  return (
    <Fragment>
      <span className="shrink-0 text-fg-3">/</span>
      <button type="button" onClick={handleSelect} className={currentClass}>
        {label}
      </button>
    </Fragment>
  )
}
