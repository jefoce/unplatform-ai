'use client'

import { isEmpty } from 'lodash-es'
import type { RefObject } from 'react'

import { GUIDE_BASE, PROVIDER_KINDS } from '@/core/providers/types'
import { Button } from '@/ui/Button'

import type { EndpointRowDraft, EndpointsDraft } from './endpoint-draft'
import { EndpointRow } from './EndpointRow'
import { ProviderLinkButton } from './ProviderLinkButton'

const COMFYUI_GUIDE = { label: 'Setup guide', url: `${GUIDE_BASE}/COMFYUI.md` }

interface CustomEndpointSectionProps {
  sectionRef: RefObject<HTMLElement | null>
  draft: EndpointsDraft
}

function noticeName(row: EndpointRowDraft): string {
  const badge = row.badge.trim()

  if (!isEmpty(badge)) {
    return badge.toUpperCase()
  }

  const label = row.label.trim()

  if (!isEmpty(label)) {
    return label
  }

  return 'Endpoint'
}

function removedText(row: EndpointRowDraft): string {
  const name = noticeName(row)

  if (row.runningJobs === 0) {
    return `${name} removed.`
  }

  if (row.runningJobs === 1) {
    return `${name} removed. 1 running job will fail when you save.`
  }

  return `${name} removed. ${row.runningJobs} running jobs will fail when you save.`
}

/** ComfyUI endpoints: add, edit, test and remove before Save. */
export function CustomEndpointSection(props: CustomEndpointSectionProps) {
  const { sectionRef, draft } = props

  const visibleRows = draft.rows.filter((row) => {
    return !row.isRemoved
  })

  const removedRows = draft.rows.filter((row) => {
    return row.isRemoved
  })

  const handleAdd = () => {
    draft.onAdd()
  }

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">
          {PROVIDER_KINDS.custom.title}
        </h3>
        <Button size="sm" variant="outline" disabled={draft.isLoading} onClick={handleAdd}>
          + Add endpoint
        </Button>
      </div>
      {draft.isLoading && <p className="text-xxs text-fg-2">Loading endpoints...</p>}
      {!draft.isLoading && draft.rows.length === 0 && (
        <div className="space-y-1 rounded-lg border border-line p-3">
          <p className="text-xxs text-fg-2">
            Run local models from ComfyUI. Install the Unplatform AI node pack, then add its address
            here.
          </p>
          <ProviderLinkButton link={COMFYUI_GUIDE} />
        </div>
      )}
      {visibleRows.map((row) => {
        return (
          <EndpointRow
            key={row.key}
            row={row}
            rows={draft.rows}
            onChange={draft.onChange}
            onTest={draft.onTest}
          />
        )
      })}
      {removedRows.map((row) => {
        const handleUndo = () => {
          draft.onChange(row.key, { isRemoved: false })
        }

        return (
          <div
            key={row.key}
            data-endpoint-removed=""
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
          >
            <p className="text-xs text-fg-2">{removedText(row)}</p>
            <Button size="sm" variant="ghost" onClick={handleUndo}>
              Undo
            </Button>
          </div>
        )
      })}
    </section>
  )
}
