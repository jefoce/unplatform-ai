'use client'

import { type MouseEvent, useCallback } from 'react'
import { Heart } from 'lucide-react'

import type { GenerationRecord } from '@/core/types'

import { toggleFavorite } from './record-actions'

interface FavoriteBadgeProps {
  record: GenerationRecord
}

/**
 * Idle favorite count pill, rendered only on liked cards. Hidden while hovered.
 * Pink gradient sits over the translucent black base.
 */
export function FavoriteBadge(props: FavoriteBadgeProps) {
  const { record } = props
  const count = record.favorite ? 1 : 0
  const handleFavorite = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      void toggleFavorite(record)
    },
    [record],
  )

  return (
    <button
      type="button"
      aria-label={record.favorite ? 'Remove favorite' : 'Favorite'}
      onClick={handleFavorite}
      className="absolute top-3 right-3 inline-flex h-6 items-center gap-1 rounded-2xl border border-white/10 bg-black/25 bg-linear-[180deg] from-favorite/22 to-favorite/8 px-2 py-1 text-white backdrop-blur-sm transition-opacity group-hover/card:pointer-events-none group-hover/card:invisible group-hover/card:opacity-0 group-has-focus-visible/card:pointer-events-none group-has-focus-visible/card:invisible group-has-focus-visible/card:opacity-0 group-has-[[data-card-menu][data-state=open]]/card:pointer-events-none group-has-[[data-card-menu][data-state=open]]/card:invisible group-has-[[data-card-menu][data-state=open]]/card:opacity-0"
    >
      <Heart size={16} className="text-favorite" fill="currentColor" aria-hidden />
      <span className="text-xs font-medium text-white tabular-nums">{count}</span>
    </button>
  )
}
