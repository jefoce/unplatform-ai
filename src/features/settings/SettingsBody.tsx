'use client'

import { type ReactNode, type RefObject } from 'react'
import { isEmpty } from 'lodash-es'

import { REMOTE_MAX_GB } from '@/core/constants'
import { STORAGE_PROVIDERS, VIDEO_PROVIDERS } from '@/core/providers/registry'
import type { SecretStatus } from '@/core/types'
import { type RemoteStatus, useRemoteStatusData } from '@/lib/api/remote'
import { formatBytes } from '@/lib/format'
import { Button } from '@/ui/Button'

import { SecretSection } from './SecretSection'
import type { SettingsSection } from './settings-store'
import type { SettingsDraft } from './use-settings-draft'

const STORAGE_DESCRIPTION = 'optional, needed for video/audio refs on some models'

interface SettingsBodyProps {
  status: SecretStatus | undefined
  draft: SettingsDraft
  sectionRefs: Record<SettingsSection, RefObject<HTMLElement | null>>
  appSection: ReactNode
}

function storedNote(remote: RemoteStatus | undefined): string | undefined {
  if (remote?.configured !== true) {
    return undefined
  }

  return `Stored ${formatBytes(remote.storedBytes)} of ${REMOTE_MAX_GB} GB`
}

/** Loading, error and key sections inside the settings modal. */
export function SettingsBody(props: SettingsBodyProps) {
  const { status, draft, sectionRefs, appSection } = props
  const remote = useRemoteStatusData()

  const {
    edits,
    results,
    testing,
    retrying: isRetrying,
    ready,
    valid,
    onFieldChange: handleFieldChange,
    onTest: handleTest,
    onRetry,
  } = draft

  const handleRetry = () => {
    return void onRetry()
  }

  if (!isEmpty(status?.loadError)) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
        <p className="text-xs text-danger">{status?.loadError}</p>
        <Button size="sm" variant="outline" loading={isRetrying} onClick={handleRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (status?.loading === true) {
    return <p className="text-xs text-fg-2">Waiting for keychain access...</p>
  }

  if (!status) {
    return <p className="text-xs text-fg-2">Loading keys...</p>
  }

  return (
    <>
      {VIDEO_PROVIDERS.map((descriptor) => {
        return (
          <SecretSection
            key={descriptor.id}
            sectionRef={sectionRefs[descriptor.id]}
            descriptor={descriptor}
            keys={status.keys}
            values={edits}
            onChange={handleFieldChange}
            ready={ready[descriptor.id]}
            testing={testing === descriptor.id}
            result={results[descriptor.id]}
            onTest={handleTest}
          />
        )
      })}

      {STORAGE_PROVIDERS.map((descriptor) => {
        return (
          <SecretSection
            key={descriptor.id}
            sectionRef={sectionRefs[descriptor.id]}
            descriptor={descriptor}
            description={STORAGE_DESCRIPTION}
            keys={status.keys}
            values={edits}
            onChange={handleFieldChange}
            ready={ready[descriptor.id]}
            testing={testing === descriptor.id}
            result={results[descriptor.id]}
            note={storedNote(remote)}
            warning={
              !valid[descriptor.id] && (
                <p className="text-xxs text-danger">
                  {descriptor.id.toUpperCase()} needs all four fields
                </p>
              )
            }
            onTest={handleTest}
          />
        )
      })}

      {appSection}
    </>
  )
}
