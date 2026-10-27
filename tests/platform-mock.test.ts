import { describe, expect, it } from 'vitest'

import type { Platform } from '@/lib/platform/types'

import { mockPlatform } from './helpers/platform-mock'

const PLATFORM_KEYS = {
  kind: true,
  canChooseFiles: true,
  chooseFiles: true,
  chooseFolder: true,
  requestNotifications: true,
  notify: true,
  openExternal: true,
  confirm: true,
  saveVideo: true,
  saveVideos: true,
  onFileDrop: true,
  appInfo: true,
  checkUpdate: true,
  installUpdate: true,
  setAutoCheck: true,
  openReleasePage: true,
} satisfies Record<keyof Platform, true>

describe('platform mock', () => {
  it('implements every Platform key', () => {
    for (const key of Object.keys(PLATFORM_KEYS)) {
      expect(mockPlatform).toHaveProperty(key)
    }
  })

  it('lists onFileDrop with a real function', () => {
    expect(PLATFORM_KEYS).toHaveProperty('onFileDrop')
    expect(mockPlatform.onFileDrop).toBeTypeOf('function')
  })
})
