'use client'

import { isNil } from 'lodash-es'
import { create } from 'zustand'

import type { AppInfo, AppUpdate, UpdateProgress } from '@/lib/platform/update-schemas'

export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'upToDate' | 'error'

interface UpdateState {
  appInfo: AppInfo | null
  status: UpdateStatus
  update: AppUpdate | null
  progress: UpdateProgress | null
  error: string | null
  isDismissed: boolean
  lastCheck: string | null
  setAppInfo: (info: AppInfo) => void
  startCheck: () => void
  applyCheckResult: (update: AppUpdate | null) => void
  markCancelled: (update: AppUpdate) => void
  markError: (message: string) => void
  startInstall: () => void
  setProgress: (progress: UpdateProgress) => void
  dismiss: () => void
  setAutoCheckValue: (isOn: boolean) => void
}

/** Update notice state shared by the shell, the toast and Settings. Session only. */
export const useUpdateStore = create<UpdateState>((set, get) => {
  return {
    appInfo: null,
    status: 'idle',
    update: null,
    progress: null,
    error: null,
    isDismissed: false,
    lastCheck: null,

    setAppInfo: (info) => {
      set({ appInfo: info, lastCheck: info.lastCheck })
    },

    startCheck: () => {
      set({ status: 'checking', error: null })
    },

    applyCheckResult: (update) => {
      const hasUpdate = !isNil(update)
      const status = hasUpdate ? 'available' : 'upToDate'

      set({
        status,
        update,
        progress: null,
        error: null,
        lastCheck: new Date().toISOString(),
      })
    },

    markCancelled: (update) => {
      set({ status: 'available', update, progress: null, error: null, isDismissed: true })
    },

    markError: (message) => {
      set({ status: 'error', error: message, progress: null })
    },

    startInstall: () => {
      set({ status: 'downloading', progress: null, error: null })
    },

    setProgress: (progress) => {
      const status = progress.phase === 'downloading' ? 'downloading' : 'installing'

      set({ status, progress })
    },

    dismiss: () => {
      set({ isDismissed: true })
    },

    setAutoCheckValue: (isOn) => {
      const { appInfo } = get()

      if (isNil(appInfo)) {
        return
      }

      set({ appInfo: { ...appInfo, autoCheck: isOn } })
    },
  }
})
