import { Channel, invoke, type InvokeArgs } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { chunk, isNil } from 'lodash-es'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import { promptSlug } from '@/core/file-names'
import { extensionsForKinds } from '@/core/media-kinds'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { createFolder } from '@/lib/api/folders'
import { exportBatch, exportRecord } from '@/lib/api/generations'

import { linkPaths } from './link-paths'
import type { Platform, UpdateListener } from './types'
import {
  AppInfoSchema,
  type InstallResult,
  InstallResultSchema,
  UpdateCheckSchema,
  UpdateProgressSchema,
} from './update-schemas'

/** Tauri rejects with a string, wrap it so `messageOf` reads the real reason. */
async function invokeChecked<T>(command: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error(String(error))
  }
}

export const desktopPlatform: Platform = {
  kind: 'desktop',

  canChooseFiles: async () => {
    return true
  },

  chooseFiles: async (params): Promise<UploadItem[]> => {
    const { kinds, multiple: isMultiple, extensions } = params

    const selected = await open({
      multiple: isMultiple,
      filters: [{ name: 'Media', extensions: extensionsForKinds(kinds, extensions) }],
    })

    if (isNil(selected)) {
      return []
    }

    if (Array.isArray(selected)) {
      return linkPaths(selected)
    }

    return linkPaths([selected])
  },

  chooseFolder: async (): Promise<FolderItem | null> => {
    const selected = await open({ directory: true, multiple: false })

    if (isNil(selected) || Array.isArray(selected)) {
      return null
    }

    return createFolder(selected)
  },

  requestNotifications: async () => {
    if (await isPermissionGranted()) {
      return
    }

    await requestPermission()
  },

  notify: async (title: string, body: string) => {
    if (!(await isPermissionGranted())) {
      return
    }

    sendNotification({ title, body })
  },

  openExternal: async (url: string) => {
    await openUrl(url)
  },

  confirm: async (message: string) => {
    return ask(message, { title: 'Unplatform AI', kind: 'warning' })
  },

  saveVideo: async (record: GenerationRecord) => {
    const target = await save({
      defaultPath: `${promptSlug(record)}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })

    if (isNil(target)) {
      return false
    }

    await exportRecord({ id: record.id, path: target })

    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    const count = records.length
    const suffix = count === 1 ? '' : 's'

    const dir = await open({
      directory: true,
      multiple: false,
      title: `Choose a folder for ${count} video${suffix}`,
    })

    if (isNil(dir) || Array.isArray(dir)) {
      return { saved: 0 }
    }

    let saved = 0

    for (const part of chunk(records, HISTORY_BATCH_MAX)) {
      const result = await exportBatch({
        ids: part.map((record) => {
          return record.id
        }),
        dir,
      })

      saved += result.saved.length
    }

    return { saved, folder: dir }
  },

  onFileDrop: async (handler) => {
    return getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload

      if (payload.type === 'leave') {
        handler({ type: 'leave' })

        return
      }

      const ratio = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
      const x = payload.position.x / ratio
      const y = payload.position.y / ratio

      if (payload.type === 'drop') {
        handler({ type: 'drop', x, y, paths: payload.paths })
      } else {
        handler({ type: 'over', x, y })
      }
    })
  },

  appInfo: async () => {
    return AppInfoSchema.parse(await invokeChecked('update_info'))
  },

  checkUpdate: async () => {
    return UpdateCheckSchema.parse(await invokeChecked('update_check'))
  },

  installUpdate: async (onProgress: UpdateListener): Promise<InstallResult> => {
    const channel = new Channel<unknown>()

    channel.onmessage = (message) => {
      onProgress(UpdateProgressSchema.parse(message))
    }

    return InstallResultSchema.parse(await invokeChecked('update_install', { channel }))
  },

  setAutoCheck: async (isOn: boolean) => {
    await invokeChecked('update_set_auto', { isOn })
  },

  openReleasePage: async () => {
    await invokeChecked('update_open_release')
  },
}
