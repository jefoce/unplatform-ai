import { AlertCircle, Video } from 'lucide-react'

import { ACTIVE_STATUSES, type GenerationRecord } from '@/core/types'
import { Spinner } from '@/ui/Spinner'

interface StackIconProps {
  record: GenerationRecord
}

/** Fallback icon inside a selection stack thumb without a poster. */
export function StackIcon(props: StackIconProps) {
  const { record } = props

  if (ACTIVE_STATUSES.includes(record.status)) return <Spinner size={12} tone="muted" />

  if (record.status !== 'completed') return <AlertCircle size={12} aria-hidden />

  return <Video size={12} aria-hidden />
}
