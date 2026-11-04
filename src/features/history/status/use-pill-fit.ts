'use client'

import { type RefObject, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'

export type PillFit = 'full' | 'cancel-icon' | 'icons'

export interface PillFitWidths {
  rowWidth: number
  statusWidth: number
  cancelWidth: number
  cancelIconWidth: number
  gap: number
}

/** First mode where the row fits: both labels, cancel icon only, then both icons. */
export function pickPillFit(widths: PillFitWidths): PillFit {
  const { rowWidth, statusWidth, cancelWidth, cancelIconWidth, gap } = widths

  if (rowWidth >= statusWidth + cancelWidth + gap) {
    return 'full'
  }

  if (rowWidth >= statusWidth + cancelIconWidth + gap) {
    return 'cancel-icon'
  }

  return 'icons'
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  return 0
}

function pillChromeWidth(pill: HTMLElement): number {
  const style = getComputedStyle(pill)
  const icon = pill.firstElementChild
  const iconWidth = icon instanceof HTMLElement ? icon.getBoundingClientRect().width : 0

  return parsePx(style.paddingLeft) + parsePx(style.paddingRight) + iconWidth
}

function pillFullWidth(pill: HTMLElement, label: HTMLElement): number {
  const gap = parsePx(getComputedStyle(pill).columnGap)
  const labelWidth = label.scrollWidth
  const innerGap = labelWidth > 0 ? gap : 0

  return Math.ceil(pillChromeWidth(pill) + innerGap + labelWidth)
}

function measurePillFit(row: HTMLElement): PillFit {
  const statusPill = row.querySelector<HTMLElement>('[data-status-pill]')
  const statusLabel = statusPill?.querySelector<HTMLElement>('[data-status-label]')

  if (isNil(statusPill) || isNil(statusLabel)) {
    return 'icons'
  }

  const rowWidth = row.getBoundingClientRect().width
  const statusWidth = pillFullWidth(statusPill, statusLabel)
  const cancelPill = row.querySelector<HTMLElement>('[data-grace-cancel]')
  const cancelLabel = cancelPill?.querySelector<HTMLElement>('[data-status-label]')

  if (isNil(cancelPill) || isNil(cancelLabel)) {
    return pickPillFit({ rowWidth, statusWidth, cancelWidth: 0, cancelIconWidth: 0, gap: 0 })
  }

  return pickPillFit({
    rowWidth,
    statusWidth,
    cancelWidth: pillFullWidth(cancelPill, cancelLabel),
    cancelIconWidth: Math.ceil(pillChromeWidth(cancelPill)),
    gap: parsePx(getComputedStyle(row).columnGap),
  })
}

/** Label mode for the status row, re-measured on resize and label changes. */
export function usePillFit(row: RefObject<HTMLDivElement | null>): PillFit {
  const [fit, setFit] = useState<PillFit>('full')

  useEffect(() => {
    const node = row.current

    if (isNil(node) || typeof ResizeObserver === 'undefined') {
      return
    }

    const measure = () => {
      setFit(measurePillFit(node))
    }

    measure()

    const resize = new ResizeObserver(measure)
    const mutation = new MutationObserver(measure)

    resize.observe(node)
    mutation.observe(node, { childList: true, subtree: true, characterData: true })

    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [row])

  return fit
}
