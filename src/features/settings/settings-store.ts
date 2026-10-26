'use client'

import { create } from 'zustand'

import {
  STORAGE_PROVIDER_IDS,
  type StorageProviderId,
  VIDEO_PROVIDER_IDS,
  type VideoProviderId,
} from '@/core/providers/types'

export const SETTINGS_SECTION_IDS = [...VIDEO_PROVIDER_IDS, ...STORAGE_PROVIDER_IDS] as const

export type SettingsSection = VideoProviderId | StorageProviderId

interface SettingsState {
  open: boolean
  section: SettingsSection
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set) => {
  return {
    open: false,
    section: 'openrouter',
    openSettings: (section = 'openrouter') => {
      set({ open: true, section })
    },
    closeSettings: () => {
      set({ open: false })
    },
  }
})

/** Opens the settings modal, optionally at one section. */
export function openSettings(section?: SettingsSection): void {
  useSettingsStore.getState().openSettings(section)
}
