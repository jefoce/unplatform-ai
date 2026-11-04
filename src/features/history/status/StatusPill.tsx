import { AlertCircle } from 'lucide-react'

import { type StatusHelp, statusHelpText } from '@/core/status-help'
import { cn } from '@/lib/cn'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

import {
  PILL_CLASSES,
  PILL_LABEL_CLASSES,
  PILL_LABEL_SHOWN_CLASSES,
  type Tone,
  TONE_TEXT,
} from './status-tone'

interface StatusPillProps {
  label: string
  help: StatusHelp
  tone: Tone
  isLabelVisible: boolean
}

/** Status pill with the help tooltip, icon-only under a 240 px tile. */
export function StatusPill(props: StatusPillProps) {
  const { label, help, tone, isLabelVisible } = props
  const isRed = tone === 'red'
  const spinnerClass = tone === 'gray' ? '[animation-duration:1.6s]' : undefined
  const spinnerTone = tone === 'accent' ? 'accent' : 'muted'

  return (
    <Tooltip content={statusHelpText(help)}>
      <div
        data-status-pill
        tabIndex={0}
        aria-label={`${label}. ${statusHelpText(help)}`}
        className={cn(PILL_CLASSES, 'min-w-0', TONE_TEXT[tone])}
      >
        {isRed && <AlertCircle size={16} className="shrink-0" aria-hidden />}
        {!isRed && <Spinner size={16} tone={spinnerTone} className={spinnerClass} />}
        <span
          data-status-label
          className={cn(PILL_LABEL_CLASSES, isLabelVisible && PILL_LABEL_SHOWN_CLASSES)}
        >
          {label}
        </span>
      </div>
    </Tooltip>
  )
}
