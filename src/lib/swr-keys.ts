export const REMOTE_STATUS_KEY = '/api/remote/status'

const GENERATION_ESTIMATE_URL = '/api/generations/estimate'

/** SWR key for one price-only estimate body. */
export function generationEstimateKey(json: string): readonly [string, string] {
  return [GENERATION_ESTIMATE_URL, json]
}

type HistoryRefresh = () => Promise<unknown>

let historyRefresh: HistoryRefresh | null = null

/** Registers the mounted infinite hook so global callers can revalidate it. */
export function registerHistoryRefresh(refresh: HistoryRefresh | null): void {
  historyRefresh = refresh
}

/** Revalidates the registered infinite history hook, if any. */
export function refreshHistory(): Promise<unknown> {
  return historyRefresh?.() ?? Promise.resolve()
}
