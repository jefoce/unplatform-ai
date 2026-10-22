'use client'

import { KIND_PLURAL, MEDIA_KINDS } from '@/core/media-kinds'
import type { ModelPreset } from '@/core/presets'
import type { DropProps } from '@/features/media-picker/use-drop-upload'
import { cn } from '@/lib/cn'

import { REFERENCE_ICONS } from './reference-icons'

function joinList(items: string[]): string {
  if (items.length < 2) return items[0] ?? ''

  if (items.length === 2) return `${items[0]} and ${items[1]}`

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

interface ReferencesEmptyProps {
  preset: ModelPreset
  dropProps: DropProps
  dragging: boolean
  onPick: () => void
}

/** Drop target shown when no references are attached. */
export function ReferencesEmpty(props: ReferencesEmptyProps) {
  const { preset, dropProps, dragging: isDragging, onPick: handlePick } = props
  const kinds = MEDIA_KINDS.filter((kind) => preset.references[kind] > 0)

  return (
    <button
      type="button"
      onClick={handlePick}
      {...dropProps}
      className={cn(
        'flex min-h-30 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-divider bg-surface p-4',
        isDragging && 'border-lime/50 bg-lime/5',
      )}
    >
      <span className="mb-3 flex">
        {REFERENCE_ICONS.map((Icon, index) => (
          <span
            /* eslint-disable-next-line react/no-array-index-key -- static list */
            key={index}
            className={cn(
              'flex size-9 items-center justify-center rounded-full border border-white/50 bg-white/4 text-fg-2 backdrop-blur-xs',
              index > 0 && '-mx-1',
            )}
          >
            <Icon size={16} />
          </span>
        ))}
      </span>
      <span className="text-sm font-medium text-fg-2">Add references</span>
      <span className="mt-1 text-xs font-medium text-fg-2">
        Up to {joinList(kinds.map((kind) => `${preset.references[kind]} ${KIND_PLURAL[kind]}`))}
      </span>
    </button>
  )
}
