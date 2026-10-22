import type { FolderItem, UploadItem } from '@/core/types'

import type { Platform } from './types'

let instance: Promise<Platform> | null = null

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Desktop module is loaded only inside the app, so the browser bundle never contains Tauri code. */
export function getPlatform(): Promise<Platform> {
  instance ??= isDesktop()
    ? import('./desktop').then((module) => module.desktopPlatform)
    : import('./browser').then((module) => module.browserPlatform)

  return instance
}

const impl = (): Promise<Platform> => getPlatform()

/** Same methods as `Platform`, resolving the implementation per call. */
export const platform = {
  canChooseFiles: async (): Promise<boolean> => (await impl()).canChooseFiles(),
  chooseFiles: async (...args: Parameters<Platform['chooseFiles']>): Promise<UploadItem[]> =>
    (await impl()).chooseFiles(...args),
  chooseFolder: async (): Promise<FolderItem | null> => (await impl()).chooseFolder(),
  requestNotifications: async (): Promise<void> => (await impl()).requestNotifications(),
  notify: async (...args: Parameters<Platform['notify']>): Promise<void> =>
    (await impl()).notify(...args),
  openExternal: async (...args: Parameters<Platform['openExternal']>): Promise<void> =>
    (await impl()).openExternal(...args),
  confirm: async (...args: Parameters<Platform['confirm']>): Promise<boolean> =>
    (await impl()).confirm(...args),
  saveVideo: async (...args: Parameters<Platform['saveVideo']>): Promise<boolean> =>
    (await impl()).saveVideo(...args),
  saveVideos: async (
    ...args: Parameters<Platform['saveVideos']>
  ): Promise<{ saved: number; folder?: string }> => (await impl()).saveVideos(...args),
}

export type { Platform } from './types'
