'use client'

import { isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { formatAgo } from '@/lib/format'
import type { AppUpdate, UpdateProgress } from '@/lib/platform/update-schemas'
import { useNow } from '@/lib/use-now'
import { Button } from '@/ui/Button'
import { Switch } from '@/ui/form/Switch'

import { AppNotes } from './AppNotes'
import { AppSectionHeader } from './AppSectionHeader'
import { progressText } from './progress-text'
import { type UpdateStatus, useUpdateStore } from './update-store'
import { useAppUpdateActions } from './use-app-update-actions'

const NOTE_LINES = 6

interface StatusTextParams {
  status: UpdateStatus
  update: AppUpdate | null
  progress: UpdateProgress | null
  lastCheck: string | null
  error: string | null
  now: number
}

function availableText(update: AppUpdate | null): string {
  if (isNil(update)) {
    return 'An update is available'
  }

  return `Version ${update.version} is available`
}

function upToDateText(lastCheck: string | null, now: number): string {
  if (isNil(lastCheck)) {
    return 'Up to date'
  }

  return `Up to date. Checked ${formatAgo(lastCheck, now)}`
}

function notesText(update: AppUpdate | null): string {
  if (isNil(update)) {
    return ''
  }

  return update.notes.split('\n').slice(0, NOTE_LINES).join('\n')
}

function describeStatus(params: StatusTextParams): string {
  const { status, update, progress, lastCheck, error, now } = params

  if (status === 'checking') {
    return 'Checking for updates...'
  }

  if (status === 'available') {
    return availableText(update)
  }

  if (status === 'downloading') {
    if (isNil(progress)) {
      return 'Downloading...'
    }

    return progressText(progress)
  }

  if (status === 'installing') {
    return 'Installing...'
  }

  if (status === 'upToDate') {
    return upToDateText(lastCheck, now)
  }

  if (status === 'error') {
    return error ?? 'Update failed'
  }

  return 'Not checked yet'
}

/** App version, update status and the automatic check switch in Settings. */
export function AppSection() {
  const { appInfo, status, update, progress, error, lastCheck } = useUpdateStore(
    useShallow((state) => {
      return {
        appInfo: state.appInfo,
        status: state.status,
        update: state.update,
        progress: state.progress,
        error: state.error,
        lastCheck: state.lastCheck,
      }
    }),
  )

  const { isInstalling, check, installNow, openRelease, setAutoCheck } = useAppUpdateActions()
  const now = useNow(true)

  if (isNil(appInfo)) {
    return null
  }

  const { installKind, version } = appInfo

  if (installKind === 'browser') {
    return (
      <section className="space-y-1">
        <AppSectionHeader version={version} />
      </section>
    )
  }

  const isLinuxPackage = installKind === 'linux-package'
  const isBusy = status === 'downloading' || status === 'installing'
  const isInstallable = status === 'available' && !isLinuxPackage
  const statusText = describeStatus({ status, update, progress, lastCheck, error, now })
  const notes = notesText(update)

  return (
    <section className="space-y-3">
      <AppSectionHeader version={version} />

      <AppNotes
        statusText={statusText}
        isDanger={status === 'error'}
        notes={notes}
        onOpenRelease={openRelease}
      />

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          loading={status === 'checking'}
          disabled={isBusy}
          onClick={check}
        >
          Check now
        </Button>
        {isInstallable && (
          <Button size="sm" variant="primary" loading={isInstalling} onClick={installNow}>
            Install and restart
          </Button>
        )}
        {isLinuxPackage && status === 'available' && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={openRelease}>
            Download
          </Button>
        )}
      </div>

      {isInstallable && installKind === 'macos' && (
        <p className="text-xxs text-fg-3">
          macOS asks for keychain access once after an update. Choose Always Allow.
        </p>
      )}

      <Switch
        checked={appInfo.autoCheck}
        label="Check for updates automatically"
        onCheckedChange={setAutoCheck}
      />
    </section>
  )
}
