import type { KindExtensions } from '@/core/media-kinds'
import type { FolderItem, GenerationRecord, MediaKind, UploadItem } from '@/core/types'

interface ChooseFilesParams {
  kinds: MediaKind[]
  multiple: boolean
  extensions?: KindExtensions
}

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
  saveVideos(records: GenerationRecord[]): Promise<{ saved: number; folder?: string }>

  /** Desktop only: real paths of files dropped on the window. Browser returns a no-op unsubscribe. */
  onFileDrop(handler: FileDropHandler): Promise<() => void>
}

type FileDropEvent =
  | { type: 'over'; x: number; y: number }
  | { type: 'drop'; x: number; y: number; paths: string[] }
  | { type: 'leave' }

type FileDropHandler = (event: FileDropEvent) => void
