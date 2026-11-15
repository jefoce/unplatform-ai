import type { BatchSkip } from './video'

/** Desktop export result, one entry per file copied, skipped or already present. */
export interface ExportResult {
  saved: string[]
  skipped: BatchSkip[]
  duplicates: string[]
}

interface ExportSavedEntry {
  saved: string
}

interface ExportSkippedEntry {
  skip: BatchSkip
}

interface ExportDuplicateEntry {
  duplicate: string
}

/** One file copied, skipped or already present with the same bytes. */
export type ExportEntry = ExportSavedEntry | ExportSkippedEntry | ExportDuplicateEntry
