'use client'

import { KIND_PLURAL } from '@/core/media-kinds'
import { MEDIA_KINDS } from '@/core/media-types'
import type { ModelPreset } from '@/core/presets/types'
import { joinWords } from '@/core/text'
import type { DropProps } from '@/features/media-picker/uploads/use-drop-upload'
import { cn } from '@/lib/cn'

import { REFERENCE_ICONS } from './reference-icons'

interface ReferencesEmptyProps {
  preset: ModelPreset
  dropProps: DropProps
  dragging: boolean
  onPick: () => void
}

/** Drop target shown when no references are attached. */
export function ReferencesEmpty(props: ReferencesEmptyProps) {
  const { preset, dropProps, dragging: isDragging } = props

  const kinds = MEDIA_KINDS.filter((kind) => {
    return preset.references[kind] > 0
  })

  return (
    <button
      type="button"
      onClick={props.onPick}
      {...dropProps}
      className={cn(
        'flex min-h-30 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-divider bg-surface p-4',
        isDragging && 'border-lime/50 bg-lime/5',
      )}
    >
      <span className="mb-3 flex">
        {REFERENCE_ICONS.map((Icon, index) => {
          return (
            <span
              /* eslint-disable-next-line react/no-array-index-key -- static list */
              key={index}
              className={cn(
                'flex size-9 items-center justify-center rounded-full border border-white/50 bg-white/4 text-fg-2 backdrop-blur-xs linux:bg-surface-2',
                index > 0 && '-mx-1',
              )}
            >
              <Icon size={16} />
            </span>
          )
        })}
      </span>
      <span className="text-sm font-medium text-fg-2">Add references</span>
      <span className="mt-1 text-xs font-medium text-fg-2">
        Up to{' '}
        {joinWords(
          kinds.map((kind) => {
            return `${preset.references[kind]} ${KIND_PLURAL[kind]}`
          }),
          'and',
        )}
      </span>
    </button>
  )
}
