'use client'

import { type ReactNode, type RefObject } from 'react'
import { isNil } from 'lodash-es'

import type { StorageProviderDescriptor, VideoProviderDescriptor } from '@/core/providers/types'
import type { SecretName } from '@/core/secret-names'
import type { SecretKeyStatus } from '@/core/types'
import { Button } from '@/ui/Button'

import { ProviderLinkButton } from './ProviderLinkButton'
import { SecretFields } from './SecretFields'
import type { SettingsSection } from './settings-store'
import { TestMessageLine } from './TestMessageLine'
import type { TestMessage } from './use-secrets'
import type { SecretChange } from './use-settings-draft'

interface SecretSectionProps {
  sectionRef: RefObject<HTMLElement | null>
  descriptor: VideoProviderDescriptor | StorageProviderDescriptor
  description?: ReactNode
  keys: Record<SecretName, SecretKeyStatus>
  values: Partial<Record<SecretName, string | null>>
  onChange: (name: SecretName, change: SecretChange) => void
  ready: boolean
  testing: boolean
  result: TestMessage | null
  note?: string
  warning?: ReactNode
  onTest: (target: SettingsSection) => void
}

/** One provider block: heading, links, key fields, Test button and result line. */
export function SecretSection(props: SecretSectionProps) {
  const {
    sectionRef,
    descriptor,
    description,
    keys,
    values,
    ready: isReady,
    testing: isTesting,
    result,
    note,
    warning,
  } = props

  const handleTest = () => {
    props.onTest(descriptor.id)
  }

  const title = isReady ? undefined : 'Save a key first'

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">
            {descriptor.label}
          </h3>
          <div className="flex items-baseline gap-3">
            {descriptor.links.map((link) => {
              return <ProviderLinkButton key={link.url} link={link} />
            })}
          </div>
        </div>
        {!isNil(description) && <p className="text-xxs text-fg-3">{description}</p>}
      </div>
      <SecretFields
        fields={descriptor.fields}
        keys={keys}
        values={values}
        onChange={props.onChange}
      />
      {!isNil(note) && <p className="text-xxs text-fg-2">{note}</p>}
      {warning}
      <div className="flex items-center gap-3">
        <span title={title}>
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
