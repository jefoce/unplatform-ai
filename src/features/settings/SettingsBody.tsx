'use client'

import { type RefObject, useCallback } from 'react'
import { isEmpty } from 'lodash-es'

import { Button } from '@/ui/Button'

import { OPENROUTER_FIELDS, R2_FIELDS } from './secret-fields'
import { SecretSection } from './SecretSection'
import type { SecretStatus } from './use-secrets'
import type { SettingsDraft } from './use-settings-draft'

interface SettingsBodyProps {
  status: SecretStatus | undefined
  draft: SettingsDraft
  openrouterRef: RefObject<HTMLElement | null>
  r2Ref: RefObject<HTMLElement | null>
}

/** Loading, error and key sections inside the settings modal. */
export function SettingsBody(props: SettingsBodyProps) {
  const { status, draft, openrouterRef, r2Ref } = props
  const {
    edits,
    results,
    testing,
    retrying: isRetrying,
    r2Valid: isR2Valid,
    openrouterReady: isOpenrouterReady,
    r2Ready: isR2Ready,
    onFieldChange: handleFieldChange,
    onTest,
    onRetry,
  } = draft
  const handleRetry = useCallback(() => void onRetry(), [onRetry])
  const handleTestOpenRouter = useCallback(() => void onTest('openrouter'), [onTest])
  const handleTestR2 = useCallback(() => void onTest('r2'), [onTest])

  const loadError = status?.loadError

  if (!isEmpty(loadError)) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
        <p className="text-xs text-danger">{loadError}</p>
        <Button size="sm" variant="outline" loading={isRetrying} onClick={handleRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (status?.loading === true) {
    return <p className="text-xs text-fg-2">Waiting for keychain access...</p>
  }

  if (!status) return <p className="text-xs text-fg-2">Loading keys...</p>

  return (
    <>
      <SecretSection
        sectionRef={openrouterRef}
        title="OpenRouter"
        fields={OPENROUTER_FIELDS}
        keys={status.keys}
        values={edits}
        onChange={handleFieldChange}
        ready={isOpenrouterReady}
        testing={testing === 'openrouter'}
        result={results.openrouter}
        onTest={handleTestOpenRouter}
      />

      <SecretSection
        sectionRef={r2Ref}
        title="Cloudflare R2"
        description={
          <span className="text-right text-xxs text-fg-2">
            optional, needed for video/audio refs on some models
          </span>
        }
        fields={R2_FIELDS}
        keys={status.keys}
        values={edits}
        onChange={handleFieldChange}
        ready={isR2Ready}
        testing={testing === 'r2'}
        result={results.r2}
        warning={!isR2Valid && <p className="text-xxs text-danger">R2 needs all four fields</p>}
        onTest={handleTestR2}
      />
    </>
  )
}
