'use client'

import { useUploadsRefresh } from '@/lib/use-uploads-refresh'

import { useImageGeneratorStore } from './store'

/** Refreshes image reference uploads and drops ones the server no longer has. */
export function useImageUploadsRefresh(references: string[]): boolean {
  const upsertUploads = useImageGeneratorStore((state) => {
    return state.upsertUploads
  })

  const dropMissingReferences = useImageGeneratorStore((state) => {
    return state.dropMissingReferences
  })

  return useUploadsRefresh({
    ids: references,
    upsert: upsertUploads,
    onMissing: dropMissingReferences,
  })
}
