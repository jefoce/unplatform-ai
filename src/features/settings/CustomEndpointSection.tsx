'use client'

import type { RefObject } from 'react'

import { GUIDE_BASE, PROVIDER_KINDS } from '@/core/providers/types'
import { Button } from '@/ui/Button'

import type { EndpointsDraft } from './endpoint-draft'
import { EndpointRow } from './EndpointRow'
import { ProviderLinkButton } from './ProviderLinkButton'

const COMFYUI_GUIDE = { label: 'Setup guide', url: `${GUIDE_BASE}/COMFYUI.md` }

interface CustomEndpointSectionProps {
  sectionRef: RefObject<HTMLElement | null>
  draft: EndpointsDraft
}

/** ComfyUI endpoints: add, edit, test and remove before Save. */
export function CustomEndpointSection(props: CustomEndpointSectionProps) {
  const { sectionRef, draft } = props

  const handleAdd = () => {
    draft.onAdd()
  }

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
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
      {draft.rows.map((row) => {
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
    </section>
  )
}
