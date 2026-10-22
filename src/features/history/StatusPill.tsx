import { AlertCircle } from 'lucide-react'

import { type StatusHelp, statusHelpText } from '@/core/status-help'
import { cn } from '@/lib/cn'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

import { PILL_CLASSES, PILL_COMPACT_CLASSES, type Tone, TONE_TEXT } from './status-tone'

interface StatusPillProps {
  label: string
  help: StatusHelp
  tone: Tone
  isCompact: boolean
}

/** Status pill with the help tooltip. */
export function StatusPill(props: StatusPillProps) {
  const { label, help, tone, isCompact } = props
  const isRed = tone === 'red'
  const spinnerClass = tone === 'gray' ? '[animation-duration:1.6s]' : undefined

  return (
    <Tooltip content={statusHelpText(help)}>
      <div
        tabIndex={0}
        className={cn(PILL_CLASSES, TONE_TEXT[tone], isCompact && PILL_COMPACT_CLASSES)}
      >
        {isRed ? (
          <AlertCircle size={16} className="shrink-0" aria-hidden />
        ) : (
          <Spinner size={16} tone={tone === 'lime' ? 'lime' : 'muted'} className={spinnerClass} />
        )}
        <span className="min-w-0 truncate">{label}</span>
      </div>
    </Tooltip>
  )
}
