'use client'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { ACTIVE_STATUSES } from '@/core/types'
import { useNow } from '@/lib/use-now'
import { Tooltip } from '@/ui/Tooltip'

import { canonicalPrompt } from '../actions/record-view'
import { costInfo } from './details-info'
import { DetailsActions } from './DetailsActions'
import { DetailsPrompt } from './DetailsPrompt'
import { DetailsSettings } from './DetailsSettings'
import { InputThumbs } from './InputThumbs'

interface DetailsPanelProps {
  record: GenerationRecord
  onDeleted?: () => void
}

/** Prompt, inputs, settings, actions and cost for one record. */
export function DetailsPanel(props: DetailsPanelProps) {
  const { record } = props
  const plain = canonicalPrompt(record)
  const cost = costInfo(record)
  const isActive = ACTIVE_STATUSES.includes(record.status)
  const now = useNow(isActive)

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-page-2 p-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pr-2 pl-1.5 text-xxs font-semibold text-fg">
          {record.preset.title}
        </span>
        <Tooltip content={cost.note}>
          <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pr-2 pl-1.5 text-xxs font-semibold text-fg">
            {cost.text}
          </span>
        </Tooltip>
      </div>

      <DetailsPrompt record={record} plain={plain} />

      <InputThumbs record={record} />

      <DetailsSettings record={record} />

      <DetailsActions record={record} isActive={isActive} now={now} onDeleted={props.onDeleted} />
    </div>
  )
}
