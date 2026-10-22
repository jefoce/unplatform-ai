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
import type { FolderItem, GenerationRecord, UploadItem } from '@/core/types'
import { apiPost } from '@/lib/fetcher'

import { linkPaths } from './link-paths'
import type { Platform } from './types'

export const desktopPlatform: Platform = {
  kind: 'desktop',

  canChooseFiles: async () => true,

  chooseFiles: async (params): Promise<UploadItem[]> => {
    const { kinds, multiple: isMultiple, extensions } = params
    const selected = await open({
      multiple: isMultiple,
      filters: [{ name: 'Media', extensions: extensionsForKinds(kinds, extensions) }],
    })

    if (isNil(selected)) return []

    if (Array.isArray(selected)) return linkPaths(selected)

    return linkPaths([selected])
  },

  chooseFolder: async (): Promise<FolderItem | null> => {
    const selected = await open({ directory: true, multiple: false })

    if (isNil(selected) || Array.isArray(selected)) return null

    return apiPost<FolderItem>('/api/folders', { path: selected })
  },

  requestNotifications: async () => {
    if (await isPermissionGranted()) return

    await requestPermission()
  },

  notify: async (title: string, body: string) => {
    if (!(await isPermissionGranted())) return

    sendNotification({ title, body })
  },

  openExternal: async (url: string) => {
    await openUrl(url)
  },

  confirm: async (message: string) => ask(message, { title: 'Unplatform AI', kind: 'warning' }),

  saveVideo: async (record: GenerationRecord) => {
    const target = await save({
      defaultPath: `${promptSlug(record)}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })

    if (isNil(target)) return false

    await apiPost(`/api/generations/${record.id}/export`, { path: target, overwrite: true })

    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    const count = records.length
    const dir = await open({
      directory: true,
      multiple: false,
      title: `Choose a folder for ${count} video${count === 1 ? '' : 's'}`,
    })

    if (isNil(dir) || Array.isArray(dir)) return { saved: 0 }

    let saved = 0

    for (const part of chunk(records, HISTORY_BATCH_MAX)) {
      const result = await apiPost<{ saved: string[] }>('/api/generations/export-batch', {
        ids: part.map((record) => record.id),
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

      if (payload.type === 'drop') handler({ type: 'drop', x, y, paths: payload.paths })
      else handler({ type: 'over', x, y })
    })
  },
}
