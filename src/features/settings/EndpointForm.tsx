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
import { EndpointIdentityFields } from './EndpointIdentityFields'
import { EndpointPriceField } from './EndpointPriceField'
import { EndpointTestResult } from './EndpointTestResult'

interface EndpointFormProps {
  row: EndpointRowDraft
  rows: EndpointRowDraft[]
  onChange: (key: string, patch: EndpointRowPatch) => void
  onTest: (key: string) => void
}

interface TokenHint {
  placeholder: string
  description: string | null
}

function tokenHint(row: EndpointRowDraft): TokenHint {
  if (row.isTokenRemoved) {
    return { placeholder: 'Optional', description: 'Will remove the stored token' }
  }

  if (!isNil(row.tokenHint)) {
    return { placeholder: `•••• ${row.tokenHint}`, description: `Stored, ending ${row.tokenHint}` }
  }

  if (row.hasToken) {
    return { placeholder: 'Optional', description: 'Stored' }
  }

  return { placeholder: 'Optional', description: null }
}

/** Expanded endpoint fields, test control and inline result. */
export function EndpointForm(props: EndpointFormProps) {
  const { row, rows } = props
  const badgeMessage = badgeError(row, rows)
  const urlMessage = urlError(row.baseUrl)
  const sameBadge = sameInstanceBadge(row, rows)
  const token = tokenHint(row)

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
    <div className="space-y-3 px-3 pt-0 pb-3">
      <EndpointIdentityFields row={row} message={badgeMessage} onChange={props.onChange} />
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
      <Field label="Token (optional)" hint={token.description}>
        <PasswordInput
          value={row.tokenValue}
          placeholder={token.placeholder}
          onChange={handleTokenChange}
        />
      </Field>
      {row.hasToken && !row.isTokenRemoved && (
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
      <div className="flex items-start justify-between gap-3">
        <Button size="sm" variant="outline" loading={row.isTesting} onClick={handleTest}>
          Test
        </Button>
        <div className="min-w-0 flex-1 text-right">
          <EndpointTestResult test={row.test} />
        </div>
      </div>
    </div>
  )
}
