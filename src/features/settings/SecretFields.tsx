'use client'

import { isNull } from 'lodash-es'

import type { SecretChange, SecretFieldDef } from './secret-fields'
import { SecretField } from './SecretField'
import type { SecretKeyStatus, SecretName } from './use-secrets'

interface SecretFieldsProps {
  fields: SecretFieldDef[]
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
}

/** Renders a list of secret fields bound to the modal draft. */
export function SecretFields(props: SecretFieldsProps) {
  const { fields, keys, values, onChange: handleChange } = props

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <SecretField
          key={field.name}
          name={field.name}
          label={field.label}
          hint={field.hint}
          status={keys[field.name]}
          value={values[field.name] ?? ''}
          remove={isNull(values[field.name])}
          onChange={handleChange}
        />
      ))}
    </div>
  )
}
