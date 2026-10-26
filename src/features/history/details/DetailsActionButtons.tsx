'use client'

import { Download, Heart } from 'lucide-react'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

interface DetailsActionButtonsProps {
  record: GenerationRecord
  onDownload: () => void
  onFavorite: () => void
}

/** Download and favorite buttons for a details panel record. */
export function DetailsActionButtons(props: DetailsActionButtonsProps) {
  const { record } = props
  const favoriteLabel = record.favorite ? 'Remove favorite' : 'Favorite'

  return (
    <>
      {record.status === 'completed' && (
        <Tooltip content="Download">
          <button
            type="button"
            onClick={props.onDownload}
            aria-label="Download"
            className="inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-fg-2 transition hover:bg-hover"
          >
            <Download size={14} aria-hidden />
          </button>
        </Tooltip>
      )}
      {record.status !== 'failed' && (
        <Tooltip content={favoriteLabel}>
          <button
            type="button"
            aria-label={favoriteLabel}
            onClick={props.onFavorite}
            className={cn(
              'inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-fg-2 transition hover:bg-hover',
              record.favorite && 'text-favorite',
            )}
          >
            <Heart size={14} className={cn(record.favorite && 'fill-current')} aria-hidden />
          </button>
        </Tooltip>
      )}
    </>
  )
}
