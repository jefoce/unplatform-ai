import { Music } from 'lucide-react'

import { isNonEmptyString } from '@/core/guards'
import { idForSlot, type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { InputSnapshot } from '@/core/schemas/generation-record'
import { uploadThumbUrl } from '@/lib/api/media-urls'
import { RetryImage } from '@/ui/RetryImage'

interface PromptSlotProps {
  slot: RefSlot
  slots: Map<string, RefSlot>
  snapshot: InputSnapshot
}

/** One prompt token: live slot chip or red missing-slot chip. */
export function PromptSlot(props: PromptSlotProps) {
  const { slot, slots, snapshot } = props
  const label = slotLabel(slot)
  const id = idForSlot(slots, slot)

  if (!isNonEmptyString(id)) {
    return <span className="mx-0.5 rounded-sm bg-danger/10 px-1 text-xs text-danger">@{label}</span>
  }

  const item = snapshot[id]

  return (
    <span
      title={item?.originalName ?? label}
      className="mx-0.5 inline-flex items-center gap-1 rounded-sm bg-accent/10 px-0.5 align-middle text-xs font-medium text-accent"
    >
      {slot.kind === 'audio' && <Music size={12} />}
      {slot.kind !== 'audio' && (
        <RetryImage
          src={uploadThumbUrl(id, 64)}
          alt=""
          kind={slot.kind}
          placeholder={<span />}
          className="size-4 rounded-xs object-cover"
        />
      )}
      @{label}
    </span>
  )
}
