'use client'

import type { EndpointHealthView } from '@/core/api/endpoints'

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

interface EndpointRowProps {
  row: EndpointRowDraft
  rows: EndpointRowDraft[]
  onChange: (key: string, patch: EndpointRowPatch) => void
  onTest: (key: string) => void
}

function runningText(count: number): string {
  if (count === 1) {
    return '1 running job on this endpoint will fail'
  }

  return `${count} running jobs on this endpoint will fail`
}

/** One endpoint row that expands into its form. */
export function EndpointRow(props: EndpointRowProps) {
  const { row, rows } = props
  const summary = videoSummary(row)
  const statusLabel = STATUS_LABELS[row.status]

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
    props.onChange(row.key, { isRemoved: !row.isRemoved })
  }

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          aria-expanded={row.isExpanded}
          onClick={handleToggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="w-10 shrink-0 rounded-chip bg-page-2 py-0.5 text-center font-mono text-xxs text-fg-2">
            {row.badge}
          </span>
          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-xs font-medium text-fg">{row.label}</span>
              {row.isRemoved && (
                <span className="shrink-0 text-xxs text-danger">Will be removed</span>
              )}
              {!row.isRemoved && <span className="shrink-0 text-xxs text-fg-2">{statusLabel}</span>}
            </span>
            <span className="block truncate text-xxs text-fg-2">{summary}</span>
            {row.isRemoved && row.runningJobs > 0 && (
              <span className="block text-xxs text-warn">{runningText(row.runningJobs)}</span>
            )}
          </span>
        </button>
        <EndpointMenu
          isEnabled={row.enabled}
          isRemoved={row.isRemoved}
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
