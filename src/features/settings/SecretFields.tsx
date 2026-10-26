'use client'

import { isNull } from 'lodash-es'

import type { ProviderSecretField } from '@/core/providers/types'
import type { SecretName } from '@/core/secret-names'
import type { SecretKeyStatus } from '@/core/types'

import { SecretField } from './SecretField'
import type { SecretChange } from './use-settings-draft'

interface SecretFieldsProps {
  fields: readonly ProviderSecretField[]
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
}

/** Renders a list of secret fields bound to the modal draft. */
export function SecretFields(props: SecretFieldsProps) {
  const { fields, keys, values } = props

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        return (
          <SecretField
            key={field.name}
            name={field.name}
            label={field.label}
            hint={field.hint}
            status={keys[field.name]}
            value={values[field.name] ?? ''}
            remove={isNull(values[field.name])}
            onChange={props.onChange}
          />
        )
      })}
    </div>
  )
}
