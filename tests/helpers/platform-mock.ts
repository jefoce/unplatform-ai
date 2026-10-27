import { vi } from 'vitest'

import type { Platform } from '@/lib/platform/types'
import type { AppInfo } from '@/lib/platform/update-schemas'

interface FileDropOverEvent {
  type: 'over'
  x: number
  y: number
}

interface FileDropDropEvent {
  type: 'drop'
  x: number
  y: number
  paths: string[]
}

interface FileDropLeaveEvent {
  type: 'leave'
}

type FileDropEvent = FileDropOverEvent | FileDropDropEvent | FileDropLeaveEvent

type FileDropHandler = (event: FileDropEvent) => void

let dropHandler: FileDropHandler | null = null

async function registerFileDrop(handler: FileDropHandler): Promise<() => void> {
  dropHandler = handler

  return () => {
    if (dropHandler === handler) {
      dropHandler = null
    }
  }
}

/** Sends one desktop drop event to the handler captured by `onFileDrop`. */
export function emitFileDrop(event: FileDropEvent): void {
  dropHandler?.(event)
}

/** Every Platform method, so a new interface method fails the type check here. */
export const mockPlatform: Platform = {
  kind: 'desktop',

  canChooseFiles: vi.fn(async () => {
    return true
  }),

  chooseFiles: vi.fn(async () => {
    return []
  }),

  chooseFolder: vi.fn(async () => {
    return null
  }),

  requestNotifications: vi.fn(async () => {}),

  notify: vi.fn(async () => {}),

  openExternal: vi.fn(async () => {}),

  confirm: vi.fn(async () => {
    return true
  }),

  saveVideo: vi.fn(async () => {
    return true
  }),

  saveVideos: vi.fn(async () => {
    return { saved: 0 }
  }),

  onFileDrop: vi.fn(registerFileDrop),

  appInfo: vi.fn(async (): Promise<AppInfo> => {
    return { version: '', installKind: 'macos', autoCheck: false, lastCheck: null }
  }),

  checkUpdate: vi.fn(async () => {
    return null
  }),

  installUpdate: vi.fn(async () => {
    return { cancelled: true }
  }),

  setAutoCheck: vi.fn(async () => {}),

  openReleasePage: vi.fn(async () => {}),
}
