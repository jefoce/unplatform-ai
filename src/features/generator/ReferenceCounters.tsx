'use client'

import { Minimize2 } from 'lucide-react'

import { MEDIA_KINDS } from '@/core/media-kinds'
import type { ModelPreset } from '@/core/presets'
import type { SlotCounts } from '@/core/prompt-tokens'
import type { ReferencePlan } from '@/core/types'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { REFERENCE_ICONS } from './reference-icons'

interface ReferenceCountersProps {
  counts: SlotCounts
  preset: ModelPreset
  plan: ReferencePlan | null
}

/** Per-kind attached/limit counters with a downscale hint on images. */
export function ReferenceCounters(props: ReferenceCountersProps) {
  const { counts, preset, plan } = props
  const isDownscaled = Boolean(plan && plan.step > 1)

  return (
    <div className="mb-4 flex w-full items-center px-1.5">
      {MEDIA_KINDS.filter((kind) => preset.references[kind] > 0).map((kind) => {
        const Icon = REFERENCE_ICONS[MEDIA_KINDS.indexOf(kind)]
        const count = `${counts[kind]}/${preset.references[kind]}`
        const hasHint = isDownscaled && kind === 'image'
        const counter = (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs tabular-nums',
              hasHint ? 'font-semibold text-info' : 'text-fg-2',
            )}
          >
            {hasHint && <Minimize2 size={12} className="shrink-0" aria-hidden />}
            {count}
          </span>
        )

        return (
          <span key={kind} className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <Icon size={12} className="shrink-0 text-fg-2" aria-hidden />
            {hasHint && plan ? (
              <Tooltip
                content={`Images will be sent at up to ${plan.maxSide} px to fit the request size. Remove some images to send them at 4K.`}
              >
                {counter}
              </Tooltip>
            ) : (
              counter
            )}
          </span>
        )
      })}
    </div>
  )
}
