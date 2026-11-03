import type { BatchSkip } from './video'

/** Desktop export result, one entry per file copied or skipped. */
export interface ExportResult {
  saved: string[]
  skipped: BatchSkip[]
}

interface ExportSavedEntry {
  saved: string
}

interface ExportSkippedEntry {
  skip: BatchSkip
}

/** One file copied or skipped by a desktop export. */
export type ExportEntry = ExportSavedEntry | ExportSkippedEntry
