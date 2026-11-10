'use client'

import type { ChangeEvent } from 'react'

import { Field } from '@/ui/form/Field'
import { Input } from '@/ui/form/Input'

import type { EndpointRowDraft, EndpointRowPatch } from './endpoint-draft'

interface EndpointIdentityFieldsProps {
  row: EndpointRowDraft
  message: string | null
  onChange: (key: string, patch: EndpointRowPatch) => void
}

/** Label and badge on one row, sharing their change handlers. */
export function EndpointIdentityFields(props: EndpointIdentityFieldsProps) {
  const { row, message } = props

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { label: event.target.value })
  }

  const handleBadgeChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { badge: event.target.value.toUpperCase() })
  }

  return (
    <div className="flex items-start gap-3">
      <Field label="Label" className="flex-1">
        <Input value={row.label} maxLength={40} onChange={handleLabelChange} />
      </Field>
      <Field
        label="Badge"
        className="w-24"
        error={message}
        description={<p className="text-xxs text-fg-2">1 to 4 uppercase letters or digits</p>}
      >
        <Input value={row.badge} maxLength={4} onChange={handleBadgeChange} />
      </Field>
    </div>
  )
}
