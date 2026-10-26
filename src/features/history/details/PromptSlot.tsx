import { Music } from 'lucide-react'

import { isNonEmptyString } from '@/core/guards'
import { idForSlot, type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { GenerationRecord } from '@/core/schemas/generation-record'

import { recordSlots, uploadThumb } from '../actions/record-view'

interface PromptSlotProps {
  slot: RefSlot
  record: GenerationRecord
}

/** One prompt token: live slot chip or red missing-slot chip. */
export function PromptSlot(props: PromptSlotProps) {
  const { slot, record } = props
  const label = slotLabel(slot)
  const id = idForSlot(recordSlots(record).slots, slot)

  if (!isNonEmptyString(id)) {
    return <span className="mx-0.5 rounded-sm bg-danger/10 px-1 text-xs text-danger">@{label}</span>
  }

  const item = record.inputsSnapshot[id]

  return (
    <span
      title={item?.originalName ?? label}
      className="mx-0.5 inline-flex items-center gap-1 rounded-sm bg-lime/10 px-0.5 align-middle text-xs font-medium text-lime"
    >
      {slot.kind === 'audio' && <Music size={12} />}
      {slot.kind !== 'audio' && (
        /* eslint-disable-next-line @next/next/no-img-element -- 16px mention thumb */
        <img src={uploadThumb(id, 64)} alt="" className="size-4 rounded-xs object-cover" />
      )}
      @{label}
    </span>
  )
}
