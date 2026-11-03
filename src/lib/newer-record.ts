interface UpdatedRecord {
  updatedAt: string
}

/** True when the local record was updated after the polled one. */
export function isNewerRecord(local: UpdatedRecord, polled: UpdatedRecord): boolean {
  const localAt = Date.parse(local.updatedAt)
  const polledAt = Date.parse(polled.updatedAt)

  if (!Number.isFinite(localAt) || !Number.isFinite(polledAt)) {
    return false
  }

  return localAt > polledAt
}
