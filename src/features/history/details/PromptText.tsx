import type { MediaKindCounts } from '@/core/media/media-types'
import { parsePromptParts, type RefSlot } from '@/core/prompt-tokens'
import type { InputSnapshot } from '@/core/schemas/generation-record'

import { PromptSlot } from './PromptSlot'

interface PromptTextProps {
  prompt: string
  counts: MediaKindCounts
  slots: Map<string, RefSlot>
  snapshot: InputSnapshot
}

/** Prompt text with live slot chips. */
export function PromptText(props: PromptTextProps) {
  const { prompt, counts, slots, snapshot } = props

  return (
    <>
      {parsePromptParts(prompt, counts).map((part, index) => {
        if (part.type === 'text') {
          return (
            // eslint-disable-next-line react/no-array-index-key -- static list
            <span key={index}>{part.text}</span>
          )
        }

        return (
          // eslint-disable-next-line react/no-array-index-key -- static list
          <PromptSlot key={index} slot={part.slot} slots={slots} snapshot={snapshot} />
        )
      })}
    </>
  )
}
