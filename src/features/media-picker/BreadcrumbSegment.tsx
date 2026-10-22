'use client'

import { Fragment, useCallback } from 'react'

interface BreadcrumbSegmentProps {
  label: string
  target: string
  isCurrent: boolean
  onNavigate: (sub: string) => void
}

/** One clickable sub-path segment. */
export function BreadcrumbSegment(props: BreadcrumbSegmentProps) {
  const { label, target, isCurrent, onNavigate } = props
  const handleSelect = useCallback(() => onNavigate(target), [onNavigate, target])

  return (
    <Fragment>
      <span className="shrink-0 text-fg-3">/</span>
      <button
        type="button"
        onClick={handleSelect}
        className={isCurrent ? 'shrink-0 text-fg' : 'shrink-0 transition hover:text-fg'}
      >
        {label}
      </button>
    </Fragment>
  )
}
