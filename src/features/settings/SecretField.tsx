'use client'

import { type ChangeEvent, type ReactNode } from 'react'
import { isEmpty } from 'lodash-es'

import { secretError, type SecretName } from '@/core/secret-names'
import type { SecretKeyStatus } from '@/core/types'
import { Field } from '@/ui/form/Field'
import { PasswordInput } from '@/ui/form/PasswordInput'

import type { SecretChange } from './use-settings-draft'

interface SecretFieldProps {
  name: SecretName
  label: string
  hint?: string | null
  status: SecretKeyStatus
  value: string
  remove: boolean
  onChange: (name: SecretName, change: SecretChange) => void
}

interface DescriptionParams {
  isRemoved: boolean
  isReadOnly: boolean
  isStored: boolean
  value: string
  hint?: string | null
}

function noteFor(params: DescriptionParams): string | null {
  const { isReadOnly, isStored, value } = params

  if (isReadOnly) {
    return 'Set by environment'
  }

  if (value !== '') {
    return 'Unsaved change'
  }

  if (isStored) {
    return 'Stored'
  }

  return null
}

function descriptionFor(params: DescriptionParams): ReactNode {
  const { isRemoved, isReadOnly, isStored, value, hint } = params

  if (isRemoved && !isReadOnly) {
    const isHintEmpty = isEmpty(hint)

    const removedLabel = isHintEmpty ? 'stored key' : `•••• ${hint}`

    return (
      <p className="text-xxs text-fg-2">
        Will remove <span className="line-through">{removedLabel}</span>
      </p>
    )
  }

  const note = noteFor({ isRemoved, isReadOnly, isStored, value, hint })

  if (isEmpty(note)) {
    return null
  }

  return <p className="text-xxs text-fg-2">{note}</p>
}

/** One key input: masked, with reveal, remove and undo. */
export function SecretField(props: SecretFieldProps) {
  const { name, label, hint, status, value, remove: isRemoved } = props
  const isReadOnly = status.source === 'env'
  let schemaError: string | null = null

  if (value !== '') {
    schemaError = secretError(name, value)
  }

  const hasHint = !isEmpty(status.hint)
  const isPlaceholder = status.set && hasHint

  const placeholder = isPlaceholder ? `•••• ${status.hint}` : 'Not set'

  const description = descriptionFor({
    isRemoved,
    isReadOnly,
    isStored: status.set,
    value,
    hint: status.hint,
  })

  const handleRemove = () => {
    props.onChange(name, { remove: !isRemoved })
  }

  const handleValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(name, { value: event.target.value.trim() })
  }

  const removeLabel = isRemoved ? 'Undo' : 'Remove'

  return (
    <Field
      id={name}
      label={label}
      hint={hint}
      error={schemaError}
      description={description}
      trailing={
        status.set &&
        !isReadOnly && (
          <button
            type="button"
            aria-pressed={isRemoved}
            onClick={handleRemove}
            className="h-9 shrink-0 rounded-lg border border-line px-2.5 text-xs text-fg-2 hover:bg-hover hover:text-fg aria-pressed:border-danger/40 aria-pressed:text-danger"
          >
            {removeLabel}
          </button>
        )
      }
    >
      <PasswordInput
        name={name}
        disabled={isReadOnly}
        value={value}
        placeholder={placeholder}
        onChange={handleValueChange}
      />
    </Field>
  )
}
