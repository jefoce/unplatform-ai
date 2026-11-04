'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { DOCKED_PANEL_EDGE_GAP, DOCKED_PANEL_WIDTH } from '@/core/constants'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/use-media-query'
import { Modal } from '@/ui/Modal'

const WIDE_QUERY = '(min-width: 900px)'
const MAX_PANEL_HEIGHT = 720
const SIDE_OFFSET = 8
const TOP_GAP = DOCKED_PANEL_EDGE_GAP + SIDE_OFFSET

const PANEL_CLASSES =
  'z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-page-2/85 p-2 shadow-[0_24px_60px_-20px_var(--color-backdrop)] backdrop-blur-xl linux:bg-page-2 outline-none'

const MODAL_CLASSES =
  'flex h-[min(720px,85vh)] max-h-none w-[min(900px,90vw)] flex-col bg-page-2 p-2 max-compact:w-[calc(100vw-16px)]'

type PanelPlacement = 'right' | 'top'

type PanelWidth = 'anchor' | 'default'

interface PanelSize {
  width: number
  height: number
}

interface DockedPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchor: HTMLElement | null

  /** More regions that keep the panel open on pointer-down, like the references box. */
  extraAnchors?: readonly (HTMLElement | null)[]
  fallback?: 'modal'
  placement?: PanelPlacement

  /** `anchor` matches the anchor width, `default` keeps `DOCKED_PANEL_WIDTH`. */
  width?: PanelWidth
  label: string
  children: ReactNode
  className?: string
}

interface MeasureParams {
  anchor: HTMLElement
  placement: PanelPlacement
  width: PanelWidth
}

function panelHeight(params: MeasureParams, rect: DOMRect): number {
  if (params.placement === 'top') {
    return Math.max(0, Math.min(MAX_PANEL_HEIGHT, rect.top - TOP_GAP))
  }

  return Math.min(MAX_PANEL_HEIGHT, window.innerHeight - DOCKED_PANEL_EDGE_GAP * 2)
}

function panelWidth(params: MeasureParams, rect: DOMRect): number {
  const maxWidth = window.innerWidth - DOCKED_PANEL_EDGE_GAP * 2

  if (params.width === 'anchor') {
    return Math.min(rect.width, maxWidth)
  }

  return Math.min(DOCKED_PANEL_WIDTH, maxWidth)
}

function measureAnchor(params: MeasureParams): PanelSize {
  const rect = params.anchor.getBoundingClientRect()

  return {
    width: panelWidth(params, rect),
    height: panelHeight(params, rect),
  }
}

/** True when the outside interaction started inside the anchor element. */
function isInsideAnchor(anchor: HTMLElement | null, target: EventTarget | null): boolean {
  return !isNil(anchor) && target instanceof Node && anchor.contains(target)
}

function isInsideAnyAnchor(
  anchors: readonly (HTMLElement | null)[],
  target: EventTarget | null,
): boolean {
  return anchors.some((anchor) => {
    return isInsideAnchor(anchor, target)
  })
}

/** Panel docked beside an anchor at wide widths, a centered modal below 900 px. */
export function DockedPanel(props: DockedPanelProps) {
  const {
    open: isOpen,
    anchor,
    extraAnchors = [],
    fallback = 'modal',
    placement = 'right',
    width = 'default',
    label,
    className,
    children,
  } = props

  const isWide = useMediaQuery(WIDE_QUERY)
  const [size, setSize] = useState<PanelSize | null>(null)

  useEffect(() => {
    if (!isOpen || !isWide || isNil(anchor)) {
      return
    }

    const update = () => {
      setSize(measureAnchor({ anchor, placement, width }))
    }

    update()
    window.addEventListener('resize', update)

    return () => {
      window.removeEventListener('resize', update)
    }
  }, [anchor, isOpen, isWide, placement, width])

  const handleInteractOutside = (event: Event) => {
    if (isInsideAnyAnchor([anchor, ...extraAnchors], event.target)) {
      event.preventDefault()
    }
  }

  if (isNil(anchor) || (!isWide && fallback === 'modal')) {
    return (
      <Modal
        open={isOpen}
        onOpenChange={props.onOpenChange}
        label={label}
        className={cn(MODAL_CLASSES, className)}
      >
        {children}
      </Modal>
    )
  }

  const virtualRef = { current: anchor }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={props.onOpenChange} modal={false}>
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={placement}
          align="center"
          sideOffset={SIDE_OFFSET}
          collisionPadding={8}
          className={cn(PANEL_CLASSES, className)}
          style={size ?? undefined}
          onInteractOutside={handleInteractOutside}
        >
          <PopoverPrimitive.Title className="sr-only">{label}</PopoverPrimitive.Title>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
