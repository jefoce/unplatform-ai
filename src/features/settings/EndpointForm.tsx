'use client'

import { isNil } from 'lodash-es'
import type { ChangeEvent } from 'react'

import type { CustomEndpointPricing } from '@/core/schemas/custom-endpoint'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/form/Field'
import { Input } from '@/ui/form/Input'
import { PasswordInput } from '@/ui/form/PasswordInput'
import { Switch } from '@/ui/form/Switch'

import {
  badgeError,
  type EndpointRowDraft,
  type EndpointRowPatch,
  sameInstanceBadge,
  urlError,
} from './endpoint-draft'
import { EndpointPriceField } from './EndpointPriceField'
import { EndpointTestResult } from './EndpointTestResult'

interface EndpointFormProps {
  row: EndpointRowDraft
  rows: EndpointRowDraft[]
  onChange: (key: string, patch: EndpointRowPatch) => void
  onTest: (key: string) => void
}

/** Expanded endpoint fields, test control and inline result. */
/* eslint-disable-next-line max-lines-per-function -- one form owns its endpoint fields and token controls */
export function EndpointForm(props: EndpointFormProps) {
  const { row, rows } = props
  const badgeMessage = badgeError(row, rows)
  const urlMessage = urlError(row.baseUrl)
  const sameBadge = sameInstanceBadge(row, rows)
  const hasToken = row.hasToken
  let tokenPlaceholder = 'Optional'
  let tokenDescription: string | null = null

  if (hasToken) {
    tokenDescription = 'Stored'
  }

  if (!isNil(row.tokenHint)) {
    tokenPlaceholder = `•••• ${row.tokenHint}`
    tokenDescription = `Stored, ending ${row.tokenHint}`
  }

  if (row.isTokenRemoved) {
    tokenDescription = 'Will remove the stored token'
  }

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { label: event.target.value })
  }

  const handleBadgeChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { badge: event.target.value.toUpperCase() })
  }

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { baseUrl: event.target.value })
  }

  const handleTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(row.key, { tokenValue: event.target.value, isTokenRemoved: false })
  }

  const handleTokenRemove = () => {
    props.onChange(row.key, { isTokenRemoved: true, tokenValue: '' })
  }

  const handlePricingChange = (pricing: CustomEndpointPricing) => {
    props.onChange(row.key, { pricing })
  }

  const handleEnabledChange = (isChecked: boolean) => {
    props.onChange(row.key, { enabled: isChecked })
  }

  const handleTest = () => {
    props.onTest(row.key)
  }

  return (
    <div className="space-y-3 border-t border-line p-3">
      <Field label="Label">
        <Input value={row.label} maxLength={40} onChange={handleLabelChange} />
      </Field>
      <Field label="Badge" hint="1 to 4 uppercase letters or digits" error={badgeMessage}>
        <Input value={row.badge} maxLength={4} onChange={handleBadgeChange} />
      </Field>
      <Field
        label="URL"
        hint="your ComfyUI address"
        error={urlMessage}
        description={
          !isNil(sameBadge) && <p className="text-xxs text-warn">Same ComfyUI as {sameBadge}</p>
        }
      >
        <Input value={row.baseUrl} placeholder="http://127.0.0.1:8188" onChange={handleUrlChange} />
      </Field>
      <Field label="Token (optional)" hint={tokenDescription}>
        <PasswordInput
          value={row.tokenValue}
          placeholder={tokenPlaceholder}
          onChange={handleTokenChange}
        />
      </Field>
      {hasToken && !row.isTokenRemoved && (
        <Button size="sm" variant="ghost" onClick={handleTokenRemove}>
          Remove token
        </Button>
      )}
      <EndpointPriceField pricing={row.pricing} onChange={handlePricingChange} />
      <Switch
        checked={row.enabled}
        label="Enabled"
        onCheckedChange={handleEnabledChange}
        aria-label="Enabled"
      />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" loading={row.isTesting} onClick={handleTest}>
          Test
        </Button>
      </div>
      <EndpointTestResult test={row.test} />
    </div>
  )
}
