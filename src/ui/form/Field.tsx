'use client'

import { cloneElement, type ReactElement, type ReactNode, useId } from 'react'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'

interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string | null
  description?: ReactNode
  trailing?: ReactNode
  id?: string
  className?: string
  children: ReactElement<ControlProps>
}

/** Label, hint, control and error with id and aria wiring. */
export function Field(props: FieldProps) {
  const { label, hint, error, description, trailing, id, className, children } = props
  const generated = useId()
  const controlId = id ?? children.props.id ?? generated
  const isHintId = Boolean(hint)

  const hintId = isHintId ? `${controlId}-hint` : undefined
  const hasError = isNonEmptyString(error)
  const errorId = hasError ? `${controlId}-error` : undefined

  const describedByText = [children.props['aria-describedby'], hintId, errorId]
    .filter((value): value is string => {
      return isNonEmptyString(value)
    })
    .join(' ')

  const describedBy = describedByText === '' ? undefined : describedByText

  const isAriaInvalid = hasError ? true : children.props['aria-invalid']

  const control = cloneElement(children, {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': isAriaInvalid,
  })

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={controlId} className="text-xs font-medium text-fg">
          {label}
        </label>
        {Boolean(hint) && (
          <span id={hintId} className="text-xxs text-fg-2">
            {hint}
          </span>
        )}
      </div>
      <div className="flex items-start gap-1.5">
        {control}
        {trailing}
      </div>
      {description}
      {Boolean(error) && (
        <p id={errorId} className="text-xxs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
