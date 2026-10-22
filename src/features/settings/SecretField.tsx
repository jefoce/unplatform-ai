'use client'

import { type ChangeEvent, type ReactNode, useCallback } from 'react'
import { isEmpty } from 'lodash-es'

import { secretError } from '@/core/secret-names'
import { Field } from '@/ui/form/Field'
import { PasswordInput } from '@/ui/form/PasswordInput'

import type { SecretChange } from './secret-fields'
import type { SecretKeyStatus, SecretName } from './use-secrets'

interface SecretFieldProps {
  name: SecretName
  label: string
  hint?: string
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

function softHintFor(name: SecretName, value: string): string | null {
  if (name !== 'OPENROUTER_API_KEY' || value === '' || value.startsWith('sk-or-')) return null

  return 'OpenRouter keys usually start with sk-or-'
}

function noteFor(params: DescriptionParams): string | null {
  const { isReadOnly, isStored, value } = params

  if (isReadOnly) return 'Set by environment'
  if (value !== '') return 'Unsaved change'
  if (isStored) return 'Stored'

  return null
}

function descriptionFor(params: DescriptionParams): ReactNode {
  const { isRemoved, isReadOnly, isStored, value, hint } = params

  if (isRemoved && !isReadOnly) {
    const removedLabel = isEmpty(hint) ? 'stored key' : `•••• ${hint}`

    return (
      <p className="text-xxs text-fg-2">
        Will remove <span className="line-through">{removedLabel}</span>
      </p>
    )
  }

  const note = noteFor({ isRemoved, isReadOnly, isStored, value, hint })

  if (isEmpty(note)) return null

  return <p className="text-xxs text-fg-2">{note}</p>
}

/** One key input: masked, with reveal, remove and undo. */
export function SecretField(props: SecretFieldProps) {
  const { name, label, hint, status, value, remove: isRemoved, onChange } = props
  const isReadOnly = status.source === 'env'
  let schemaError: string | null = null

  if (value !== '') schemaError = secretError(name, value)

  const softHint = softHintFor(name, value)
  const hasHint = !isEmpty(status.hint)
  const placeholder = status.set && hasHint ? `•••• ${status.hint}` : 'Not set'
  const description = descriptionFor({
    isRemoved,
    isReadOnly,
    isStored: status.set,
    value,
    hint: status.hint,
  })

  const handleRemove = useCallback(
    () => onChange(name, { remove: !isRemoved }),
    [name, onChange, isRemoved],
  )
  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(name, { value: event.target.value.trim() }),
    [name, onChange],
  )

  return (
    <>
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
              {isRemoved ? 'Undo' : 'Remove'}
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
      {Boolean(softHint) && <p className="text-xxs text-fg-2">{softHint}</p>}
    </>
  )
}
