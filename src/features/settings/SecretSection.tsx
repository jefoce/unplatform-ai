'use client'

import type { ReactNode, RefObject } from 'react'

import { Button } from '@/ui/Button'

import type { SecretChange, SecretFieldDef } from './secret-fields'
import { SecretFields } from './SecretFields'
import { TestMessageLine } from './TestMessageLine'
import type { SecretKeyStatus, SecretName, TestMessage } from './use-secrets'

interface SecretSectionProps {
  sectionRef: RefObject<HTMLElement | null>
  title: string
  description?: ReactNode
  fields: SecretFieldDef[]
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
  ready: boolean
  testing: boolean
  result: TestMessage | null
  warning?: ReactNode
  onTest: () => void
}

/** One provider block: heading, key fields, Test button and result line. */
export function SecretSection(props: SecretSectionProps) {
  const {
    sectionRef,
    title,
    description,
    fields,
    keys,
    values,
    onChange: handleChange,
    ready: isReady,
    testing: isTesting,
    result,
    warning,
    onTest: handleTest,
  } = props

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">{title}</h3>
        {description}
      </div>
      <SecretFields fields={fields} keys={keys} values={values} onChange={handleChange} />
      {warning}
      <div className="flex items-center gap-3">
        <span title={isReady ? undefined : 'Save a key first'}>
          <Button
            size="sm"
            variant="outline"
            disabled={!isReady}
            loading={isTesting}
            onClick={handleTest}
          >
            Test
          </Button>
        </span>
        <TestMessageLine result={result} />
      </div>
    </section>
  )
}
