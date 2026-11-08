'use client'

import type { EndpointHealthView } from '@/core/api/endpoints'
import { cn } from '@/lib/cn'
import { EndpointBadge } from '@/ui/EndpointBadge'

import { type EndpointRowDraft, type EndpointRowPatch, videoSummary } from './endpoint-draft'
import { EndpointForm } from './EndpointForm'
import { EndpointMenu } from './EndpointMenu'

const STATUS_LABELS = {
  ok: 'Connected',
  unreachable: 'Unreachable',
  unauthorized: 'Token needed',
  forbidden: 'Blocked',
  protocol: 'Wrong protocol',
  unknown: 'Not tested',
} satisfies Record<EndpointHealthView, string>

const STATUS_CLASSES = {
  ok: 'text-accent',
  unreachable: 'text-warn',
  unauthorized: 'text-warn',
  forbidden: 'text-warn',
  protocol: 'text-warn',
  unknown: 'text-fg-3',
} satisfies Record<EndpointHealthView, string>

interface EndpointRowProps {
  row: EndpointRowDraft
  rows: EndpointRowDraft[]
  onChange: (key: string, patch: EndpointRowPatch) => void
  onTest: (key: string) => void
}

/** One endpoint row that expands into its form. */
export function EndpointRow(props: EndpointRowProps) {
  const { row, rows } = props
  const summary = videoSummary(row)
  const statusLabel = row.enabled ? STATUS_LABELS[row.status] : 'Disabled'
  const statusClasses = row.enabled ? STATUS_CLASSES[row.status] : 'text-fg-3'

  const handleToggle = () => {
    props.onChange(row.key, { isExpanded: !row.isExpanded })
  }

  const handleRetest = () => {
    props.onTest(row.key)
  }

  const handleToggleEnabled = () => {
    props.onChange(row.key, { enabled: !row.enabled })
  }

  const handleRemove = () => {
    props.onChange(row.key, { isRemoved: true })
  }

  return (
    <div data-endpoint-row="" className="rounded-xl border border-line">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={row.isExpanded}
          onClick={handleToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <EndpointBadge badge={row.badge} />
          <span data-endpoint-text="" className="min-w-0 flex-1 space-y-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-fg">{row.label}</span>
              <span
                className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs', statusClasses)}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {statusLabel}
              </span>
            </span>
            <span className="block truncate text-xs text-fg-2">{summary}</span>
          </span>
        </button>
        <EndpointMenu
          isEnabled={row.enabled}
          onRetest={handleRetest}
          onToggleEnabled={handleToggleEnabled}
          onRemove={handleRemove}
        />
      </div>
      {row.isExpanded && (
        <EndpointForm row={row} rows={rows} onChange={props.onChange} onTest={props.onTest} />
      )}
    </div>
  )
}
