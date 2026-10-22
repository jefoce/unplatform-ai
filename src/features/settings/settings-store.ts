'use client'

import { create } from 'zustand'

export type SettingsSection = 'openrouter' | 'r2'

interface SettingsState {
  open: boolean
  section: SettingsSection
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  open: false,
  section: 'openrouter',
  openSettings: (section = 'openrouter') => set({ open: true, section }),
  closeSettings: () => set({ open: false }),
}))

/** Opens the settings modal, optionally at one section. */
export function openSettings(section?: SettingsSection): void {
  useSettingsStore.getState().openSettings(section)
}
