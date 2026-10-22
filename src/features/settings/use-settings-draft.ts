'use client'

import { useState } from 'react'
import { isEmpty, isNull, isUndefined } from 'lodash-es'
import { toast } from 'sonner'

import { secretError } from '@/core/secret-names'
import { refreshCredits } from '@/features/generator/use-credits'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/lib/platform'
import { refreshRemoteStatus } from '@/lib/remote-status'

import type { SecretChange } from './secret-fields'
import { useSecretActions } from './use-secret-actions'
import { R2_NAMES, saveSecrets, type SecretName, type SecretStatus } from './use-secrets'

type Edits = Partial<Record<SecretName, string | null>>

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
  isR2Valid: boolean
  isOpenrouterReady: boolean
  isR2Ready: boolean
}

interface ApplyChangeParams {
  current: Edits
  name: SecretName
  change: SecretChange
}

function applyChange(params: ApplyChangeParams): Edits {
  const { current, name, change } = params
  const next = { ...current }

  if (change.remove === true) next[name] = null
  else if (isEmpty(change.value)) delete next[name]
  else next[name] = change.value

  return next
}

function getDraftFlags(params: DraftFlagsParams): DraftFlags {
  const { edits, status, isMock, isSaving } = params
  const changed = Object.keys(edits) as SecretName[]
  const isDirty = !isEmpty(changed)
  const isAllValid = changed.every(
    (name) => isNull(edits[name]) || isNull(secretError(name, edits[name] ?? '')),
  )
  const r2Set = R2_NAMES.filter((name) => {
    const edit = edits[name]

    if (isNull(edit)) return false

    return isUndefined(edit) ? status?.keys[name].set === true : true
  }).length
  const isR2Valid = r2Set === 0 || r2Set === R2_NAMES.length
  const canSave = isEmpty(status?.loadError) && isDirty && isAllValid && isR2Valid && !isSaving
  const isOpenrouterReady = isMock === true || Boolean(status?.keys.OPENROUTER_API_KEY.set)
  const isR2Ready = isMock === true || R2_NAMES.every((name) => status?.keys[name].set === true)

  return { isDirty, canSave, isR2Valid, isOpenrouterReady, isR2Ready }
}

/** Draft edits, test results and save/close actions for the settings modal. */
export function useSettingsDraft(params: UseSettingsDraftParams) {
  const { status, mock: isMock, closeSettings } = params
  const [edits, setEdits] = useState<Edits>({})
  const [isSaving, setIsSaving] = useState(false)
  const { isDirty, canSave, isR2Valid, isOpenrouterReady, isR2Ready } = getDraftFlags({
    edits,
    status,
    isMock,
    isSaving,
  })
  const { results, testing, isRetrying, onTest, onRetry, resetResults } = useSecretActions({
    isDirty,
  })

  const onFieldChange = (name: SecretName, change: SecretChange) => {
    setEdits((current) => applyChange({ current, name, change }))
  }

  const onClose = async (shouldOpen: boolean) => {
    if (shouldOpen) return

    if (isDirty && !(await platform.confirm('Discard changes?'))) return

    closeSettings()
    setEdits({})
    resetResults()
  }

  const onSave = async () => {
    if (!canSave) return

    setIsSaving(true)

    try {
      await saveSecrets(edits)
      await Promise.all([refreshCredits(), refreshRemoteStatus()])
      setEdits({})
      resetResults()
      toast.success('Settings saved')
    } catch (error) {
      toast.error(errorMessage(error, 'Save failed'))
    } finally {
      setIsSaving(false)
    }
  }

  return {
    edits,
    results,
    testing,
    saving: isSaving,
    retrying: isRetrying,
    canSave,
    r2Valid: isR2Valid,
    openrouterReady: isOpenrouterReady,
    r2Ready: isR2Ready,
    onFieldChange,
    onClose,
    onTest,
    onRetry,
    onSave,
  }
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>
