import { isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'

import type { ChooseFilesParams, Platform, SavedVideos, UpdateListener } from './types'
import type { AppInfo, AppUpdate, InstallResult } from './update-schemas'

let instance: Promise<Platform> | null = null

const isDesktop = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Desktop module is loaded only inside the app, so the browser bundle never contains Tauri code. */
export function getPlatform(): Promise<Platform> {
  if (isNil(instance)) {
    if (isDesktop()) {
      instance = import('./desktop').then((module) => {
        return module.desktopPlatform
      })
    } else {
      instance = import('./browser').then((module) => {
        return module.browserPlatform
      })
    }
  }

  return instance
}

const impl = (): Promise<Platform> => {
  return getPlatform()
}

/** Same methods as `Platform`, resolving the implementation per call. */
export const platform = {
  canChooseFiles: async (): Promise<boolean> => {
    return (await impl()).canChooseFiles()
  },
  chooseFiles: async (params: ChooseFilesParams): Promise<UploadItem[]> => {
    return (await impl()).chooseFiles(params)
  },
  chooseFolder: async (): Promise<FolderItem | null> => {
    return (await impl()).chooseFolder()
  },
  requestNotifications: async (): Promise<void> => {
    return (await impl()).requestNotifications()
  },
  notify: async (title: string, body: string): Promise<void> => {
    return (await impl()).notify(title, body)
  },
  openExternal: async (url: string): Promise<void> => {
    return (await impl()).openExternal(url)
  },
  confirm: async (message: string): Promise<boolean> => {
    return (await impl()).confirm(message)
  },
  saveVideo: async (record: GenerationRecord): Promise<boolean> => {
    return (await impl()).saveVideo(record)
  },
  saveVideos: async (records: GenerationRecord[]): Promise<SavedVideos> => {
    return (await impl()).saveVideos(records)
  },
  appInfo: async (): Promise<AppInfo> => {
    return (await impl()).appInfo()
  },
  checkUpdate: async (): Promise<AppUpdate | null> => {
    return (await impl()).checkUpdate()
  },
  installUpdate: async (onProgress: UpdateListener): Promise<InstallResult> => {
    return (await impl()).installUpdate(onProgress)
  },
  setAutoCheck: async (isOn: boolean): Promise<void> => {
    return (await impl()).setAutoCheck(isOn)
  },
  openReleasePage: async (): Promise<void> => {
    return (await impl()).openReleasePage()
  },
}
