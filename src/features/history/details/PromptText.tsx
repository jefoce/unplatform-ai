import { parsePromptParts } from '@/core/prompt-tokens'
import type { GenerationRecord } from '@/core/schemas/generation-record'

import { recordCounts } from '../actions/record-view'
import { PromptSlot } from './PromptSlot'

interface PromptTextProps {
  prompt: string
  record: GenerationRecord
}

/** Prompt text with live slot chips. */
export function PromptText(props: PromptTextProps) {
  const { prompt, record } = props
  const counts = recordCounts(record)

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
          <PromptSlot key={index} slot={part.slot} record={record} />
        )
      })}
    </>
  )
}
