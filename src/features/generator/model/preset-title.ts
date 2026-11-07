const snapshotTitles = new Map<string, string>()

/** Keeps the title a record showed after its workflow leaves the catalog. */
export function rememberPresetTitle(presetId: string, title: string): void {
  snapshotTitles.set(presetId, title)
}

/** Snapshot title for an id that is gone from the catalog. */
export function presetTitleOf(presetId: string): string | null {
  return snapshotTitles.get(presetId) ?? null
}
