'use client'

import { Link2 } from 'lucide-react'

interface MediaTileBadgesProps {
  isMissing: boolean
  isLink: boolean
  isSelected: boolean
  selectIndex?: number
}

/** Missing, linked and selection badges for a media tile. */
export function MediaTileBadges(props: MediaTileBadgesProps) {
  const { isMissing, isLink, isSelected, selectIndex } = props

  return (
    <>
      {isMissing && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 z-20 rounded-sm bg-danger/20 px-1.5 py-0.5 text-xxs font-medium text-danger">
          Missing
        </span>
      )}

      {!isMissing && isLink && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-sm bg-black/60 text-fg">
          <Link2 className="size-3" aria-hidden />
        </span>
      )}

      {isSelected && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-lime text-xxs font-semibold text-on-lime">
          {(selectIndex ?? 0) + 1}
        </span>
      )}
    </>
  )
}
