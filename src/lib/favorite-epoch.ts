import { MAX_FAVORITE_EPOCHS } from '@/core/constants'

let latestEpoch = 0
const favoriteEpochs = new Map<string, number>()

/** Marks a local favorite change. Polls started before it must not revert it. */
export function markFavoriteChange(id: string): number {
  latestEpoch += 1
  favoriteEpochs.delete(id) // reinserting makes a re-marked id the newest
  favoriteEpochs.set(id, latestEpoch)

  if (favoriteEpochs.size > MAX_FAVORITE_EPOCHS) {
    const oldest = favoriteEpochs.keys().next()

    if (oldest.done === false) {
      favoriteEpochs.delete(oldest.value)
    }
  }

  return latestEpoch
}

/** Epoch to capture before a poll request. */
export function currentFavoriteEpoch(): number {
  return latestEpoch
}

/** True when a favorite changed after the poll started. */
export function favoriteChangedSince(id: string, epoch: number): boolean {
  return (favoriteEpochs.get(id) ?? 0) > epoch
}
