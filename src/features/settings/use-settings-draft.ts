'use client'

import { useState } from 'react'
import { isEmpty, isNull, isUndefined } from 'lodash-es'
import { toast } from 'sonner'

import { STORAGE_PROVIDERS, VIDEO_PROVIDERS } from '@/core/providers/registry'
import type { StorageProviderId } from '@/core/providers/types'
import { secretError, type SecretName } from '@/core/secret-names'
import type { SecretStatus } from '@/core/types'
import { refreshCredits } from '@/lib/api/credits'
import { refreshModels } from '@/lib/api/models'
import { refreshRemoteStatus } from '@/lib/api/remote'
import { saveSecrets } from '@/lib/api/settings'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'
import { useAsyncAction } from '@/lib/use-async-action'

import type { SettingsSection } from './settings-store'
import { useSecretActions } from './use-secret-actions'
import type { TestMessage } from './use-secrets'

type Edits = Partial<Record<SecretName, string | null>>

export interface SecretChange {
  value?: string
  remove?: boolean
}

interface UseSettingsDraftParams {
  status: SecretStatus | undefined
  mock: boolean | undefined
  closeSettings: () => void
}

interface DraftFlagsParams {
  edits: Edits
  status: SecretStatus | undefined
  isMock: boolean | undefined
  isSaving: boolean
}

interface DraftFlags {
  isDirty: boolean
  canSave: boolean
  sectionReady: Record<SettingsSection, boolean>
  storageValid: Record<StorageProviderId, boolean>
}

interface ApplyChangeParams {
  current: Edits
  name: SecretName
  change: SecretChange
}

export interface SettingsDraft {
  edits: Edits
  results: Record<SettingsSection, TestMessage | null>
  testing: SettingsSection | null
  saving: boolean
  retrying: boolean
  canSave: boolean
  ready: Record<SettingsSection, boolean>
  valid: Record<StorageProviderId, boolean>
  onFieldChange: (name: SecretName, change: SecretChange) => void
  onClose: (shouldOpen: boolean) => Promise<void>
  onTest: (target: SettingsSection) => Promise<void>
  onRetry: () => Promise<void>
  onSave: () => Promise<void>
}

interface CountSetSecretsParams {
  requiredSecrets: readonly SecretName[]
  edits: Edits
  status: SecretStatus | undefined
}

function applyChange(params: ApplyChangeParams): Edits {
  const { current, name, change } = params
  const next = { ...current }

  if (change.remove === true) {
    next[name] = null
  } else if (isEmpty(change.value)) {
    delete next[name]
  } else {
    next[name] = change.value
  }

  return next
}

function countSetSecrets(params: CountSetSecretsParams): number {
  const { requiredSecrets, edits, status } = params

  return requiredSecrets.filter((name) => {
    const edit = edits[name]

    if (isNull(edit)) {
      return false
    }

    if (isUndefined(edit)) {
      return status?.keys[name].set === true
    }

    return true
  }).length
}

function getDraftFlags(params: DraftFlagsParams): DraftFlags {
  const { edits, status, isMock, isSaving } = params
  const changed = Object.keys(edits) as SecretName[]
  const isDirty = !isEmpty(changed)

  const isAllValid = changed.every((name) => {
    return isNull(edits[name]) || isNull(secretError(name, edits[name] ?? ''))
  })

  const sectionReady = Object.fromEntries(
    [...VIDEO_PROVIDERS, ...STORAGE_PROVIDERS].map((descriptor) => {
      return [
        descriptor.id,
        isMock === true ||
          descriptor.requiredSecrets.every((name) => {
            return status?.keys[name].set === true
          }),
      ]
    }),
  ) as Record<SettingsSection, boolean>

  const storageValid = Object.fromEntries(
    STORAGE_PROVIDERS.map((descriptor) => {
      const setCount = countSetSecrets({
        requiredSecrets: descriptor.requiredSecrets,
        edits,
        status,
      })

      return [descriptor.id, setCount === 0 || setCount === descriptor.requiredSecrets.length]
    }),
  ) as Record<StorageProviderId, boolean>

  const isStorageValid = Object.values(storageValid).every(Boolean)
  const canSave = isEmpty(status?.loadError) && isDirty && isAllValid && isStorageValid && !isSaving

  return { isDirty, canSave, sectionReady, storageValid }
}

/** Draft edits, test results and save/close actions for the settings modal. */
export function useSettingsDraft(params: UseSettingsDraftParams): SettingsDraft {
  const { status, mock: isMock, closeSettings } = params
  const [edits, setEdits] = useState<Edits>({})
  const isDirty = !isEmpty(edits)

  const { results, testing, isRetrying, onTest, onRetry, resetResults } = useSecretActions({
    isDirty,
  })

  const saving = useAsyncAction(async () => {
    try {
      await saveSecrets(edits)
      await Promise.all([refreshCredits(), refreshRemoteStatus(), refreshModels()])
      setEdits({})
      resetResults()
      toast.success('Settings saved')
    } catch (error) {
      toastError(error, 'Save failed')
    }
  })

  const { canSave, sectionReady, storageValid } = getDraftFlags({
    edits,
    status,
    isMock,
    isSaving: saving.isRunning,
  })

  const onFieldChange = (name: SecretName, change: SecretChange) => {
    setEdits((current) => {
      return applyChange({ current, name, change })
    })
  }

  const onClose = async (shouldOpen: boolean) => {
    if (shouldOpen) {
      return
    }

    if (isDirty && !(await platform.confirm('Discard changes?'))) {
      return
    }

    closeSettings()
    setEdits({})
    resetResults()
  }

  const onSave = async () => {
    if (!canSave) {
      return
    }

    await saving.run()
  }

  return {
    edits,
    results,
    testing,
    saving: saving.isRunning,
    retrying: isRetrying,
    canSave,
    ready: sectionReady,
    valid: storageValid,
    onFieldChange,
    onClose,
    onTest,
    onRetry,
    onSave,
  }
}
