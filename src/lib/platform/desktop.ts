/* eslint-disable max-lines -- one Platform object owns every native bridge call */
import { Channel, invoke, type InvokeArgs } from '@tauri-apps/api/core'
import { resolveResource } from '@tauri-apps/api/path'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { ask, open } from '@tauri-apps/plugin-dialog'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { openPath, openUrl } from '@tauri-apps/plugin-opener'
import { chunk, isEmpty, isNil } from 'lodash-es'

import type { ExportResult } from '@/core/api/export'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import { modelBase, promptSlug } from '@/core/media/file-names'
import { extensionsForKinds } from '@/core/media/media-kinds'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { createFolder } from '@/lib/api/folders'
import { exportBatch, exportRecord } from '@/lib/api/generations'
import { exportImage, exportImageBatch } from '@/lib/api/images'

import { friendlyText } from './desktop-errors'
import { linkPaths } from './link-paths'
import type { ImageSaveRef, Platform, SaveResult, UpdateListener } from './types'
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
    throw await translateFailure(command, asError(error))
  }
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(String(error))
}

/** Writes the raw failure to desktop.log and returns the text the UI may show. */
async function translateFailure(subject: string, failure: Error): Promise<Error> {
  const text = friendlyText(failure.message)

  if (isNil(text)) {
    return failure
  }

  await invoke('log_client_error', { resource: subject, message: failure.message }).catch(() => {})

  return new Error(text)
}

interface PartTotals {
  saved: number
  skipped: number
  duplicates: number
}

interface RunPartsParams<T> {
  parts: T[][]
  total: number
  run: (part: T[]) => Promise<ExportResult>
}

/** Runs every chunk, keeps the counts, and reports the first failure with the progress. */
async function runExportParts<T>(params: RunPartsParams<T>): Promise<PartTotals> {
  const { parts, total, run } = params
  let saved = 0
  let skipped = 0
  let duplicates = 0

  for (const part of parts) {
    try {
      const result = await run(part)

      saved += result.saved.length
      skipped += result.skipped.length
      duplicates += result.duplicates.length
    } catch (error) {
      const failure = await translateFailure('export', asError(error))

      if (duplicates > 0) {
        throw new Error(
          `Saved ${saved} of ${total} files (${duplicates} already in the folder) before the error. ${failure.message}`,
        )
      }

      if (saved > 0) {
        throw new Error(`Saved ${saved} of ${total} files before the error. ${failure.message}`)
      }

      throw failure
    }
  }

  return { saved, skipped, duplicates }
}

/** Opens a bundled resource and turns a failure into short user text. */
async function openResource(name: string): Promise<void> {
  try {
    const path = await resolveResource(name)

    await openPath(path)
  } catch (error) {
    throw await translateFailure(name, asError(error))
  }
}

/** Saves one image through the save dialog, so the model name and real extension show. */
async function saveOneImage(ref: ImageSaveRef): Promise<SaveResult> {
  const ext = ref.file.slice(ref.file.lastIndexOf('.') + 1).toLowerCase()

  const target = await invokeChecked<string | null>('choose_export_path', {
    defaultName: `${ref.name}.${ext}`,
    extension: ext,
  })

  if (isNil(target)) {
    return { saved: 0, skipped: 0, duplicates: 0 }
  }

  try {
    await exportImage({ recordId: ref.recordId, outputId: ref.outputId, path: target })
  } catch (error) {
    throw await translateFailure('save image', asError(error))
  }

  return { saved: 1, skipped: 0, duplicates: 0 }
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
    try {
      await openUrl(url)
    } catch (error) {
      throw await translateFailure('open link', asError(error))
    }
  },

  openNotices: async () => {
    await openResource('THIRD_PARTY_NOTICES.md')
  },

  openLicense: async () => {
    await openResource('LICENSE')
  },

  confirm: async (message: string) => {
    return ask(message, { title: 'Unplatform AI', kind: 'warning' })
  },

  saveVideo: async (record: GenerationRecord) => {
    let base = modelBase(record)

    if (isEmpty(base)) {
      base = promptSlug(record)
    }

    const target = await invokeChecked<string | null>('choose_export_path', {
      defaultName: `${base}.mp4`,
      extension: 'mp4',
    })

    if (isNil(target)) {
      return false
    }

    try {
      await exportRecord({ id: record.id, path: target })
    } catch (error) {
      throw await translateFailure('save video', asError(error))
    }

    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    const parts = chunk(records, HISTORY_BATCH_MAX)

    const dir = await invokeChecked<string | null>('choose_export_folder', {
      uses: parts.length,
    })

    if (isNil(dir)) {
      return { saved: 0, skipped: 0, duplicates: 0 }
    }

    const totals = await runExportParts({
      parts,
      total: records.length,
      run: (part) => {
        return exportBatch({
          ids: part.map((record) => {
            return record.id
          }),
          dir,
        })
      },
    })

    return { ...totals, folder: dir }
  },

  saveImages: async (refs: ImageSaveRef[]) => {
    const [only] = refs

    if (refs.length === 1 && !isNil(only)) {
      return saveOneImage(only)
    }

    const parts = chunk(refs, HISTORY_BATCH_MAX)

    const dir = await invokeChecked<string | null>('choose_export_folder', {
      uses: parts.length,
    })

    if (isNil(dir)) {
      return { saved: 0, skipped: 0, duplicates: 0 }
    }

    const totals = await runExportParts({
      parts,
      total: refs.length,
      run: (part) => {
        return exportImageBatch({
          outputs: part.map((ref) => {
            return { recordId: ref.recordId, outputId: ref.outputId }
          }),
          dir,
        })
      },
    })

    return { ...totals, folder: dir }
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
