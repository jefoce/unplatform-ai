import type { GenerationRecord } from './schemas/generation-record'

const LEGACY_DOWNLOAD_ERROR = 'Download failed:'

/** True when the copy failed while downloading, flag first, legacy error text second. */
export function isDownloadFailure(
  record: Pick<GenerationRecord, 'downloadFailed' | 'error'>,
): boolean {
  if (record.downloadFailed === true) {
    return true
  }

  return record.error?.startsWith(LEGACY_DOWNLOAD_ERROR) === true
}
