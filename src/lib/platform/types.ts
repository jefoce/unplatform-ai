import type { KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'

import type { AppInfo, AppUpdate, InstallResult, UpdateProgress } from './update-schemas'

export interface ChooseFilesParams {
  kinds: MediaKind[]
  multiple: boolean
  extensions?: KindExtensions
}

export interface SavedVideos {
  saved: number
  folder?: string
}

export type UpdateListener = (progress: UpdateProgress) => void

export interface Platform {
  kind: 'browser' | 'desktop'

  /** Native file dialog, true when choose* works. */
  canChooseFiles(): Promise<boolean>
  chooseFiles(params: ChooseFilesParams): Promise<UploadItem[]>
  chooseFolder(): Promise<FolderItem | null>

  /** Ask once, on the first Generate. */
  requestNotifications(): Promise<void>
  notify(title: string, body: string): Promise<void>
  openExternal(url: string): Promise<void>

  /** Native confirm dialog, false when dismissed. */
  confirm(message: string): Promise<boolean>

  /** Saves a finished video where the user picks, false when the dialog is cancelled. */
  saveVideo(record: GenerationRecord): Promise<boolean>

  /** Saves many videos into one folder. Browser starts a staggered download per file. */
  saveVideos(records: GenerationRecord[]): Promise<SavedVideos>

  /** Desktop only: real paths of files dropped on the window. Browser returns a no-op unsubscribe. */
  onFileDrop(handler: FileDropHandler): Promise<() => void>

  appInfo(): Promise<AppInfo>
  checkUpdate(): Promise<AppUpdate | null>
  installUpdate(onProgress: UpdateListener): Promise<InstallResult>
  setAutoCheck(isOn: boolean): Promise<void>
  openReleasePage(): Promise<void>
}

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
