'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { isNil, uniq, uniqBy } from 'lodash-es'
import useSWR from 'swr'

import type { ImageListResult } from '@/core/api/image'
import { HISTORY_POLL_MS } from '@/core/constants'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { useWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { fetchActiveImages, fetchImagePage, imagePageKey } from '@/lib/api/images'
import { ACTIVE_IMAGES_KEY } from '@/lib/api/swr-keys'

const NO_RECORDS: ImageRecord[] = []

interface ActiveImageWatch {
  records: ImageRecord[]
  activeCount: number
}

function idsOf(records: ImageRecord[]): string[] {
  return records.map((record) => {
    return record.id
  })
}

function activeIdsOf(records: ImageRecord[]): string[] {
  return idsOf(records.filter(isImageActive))
}

/** Watches active image jobs while the workspace hides the image feed. */
export function useActiveImageWatch(knownRecords: ImageRecord[]): ActiveImageWatch {
  const tab = useWorkspaceTab()
  const isHidden = tab !== 'image'

  const key = isHidden ? ACTIVE_IMAGES_KEY : null

  const [finished, setFinished] = useState<ImageRecord[]>([])
  const isFinishedActive = finished.some(isImageActive)

  const { data } = useSWR<ImageListResult>(key, fetchActiveImages, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    refreshInterval: (latest) => {
      const count = latest?.activeCount ?? 0

      if (count > 0 || isFinishedActive) {
        return HISTORY_POLL_MS
      }

      return 0
    },
  })

  const previousIds = useRef<string[]>([])
  const wasHidden = useRef(false)
  const known = useRef<ImageRecord[]>([])

  const active = useMemo(() => {
    return data?.items ?? []
  }, [data])

  useEffect(() => {
    if (knownRecords.length > 0) {
      known.current = knownRecords
    }
  }, [knownRecords])

  useEffect(() => {
    if (!isHidden) {
      wasHidden.current = false
      previousIds.current = []

      return
    }

    if (!wasHidden.current) {
      wasHidden.current = true

      previousIds.current = activeIdsOf(known.current)
    }

    if (isNil(data)) {
      return
    }

    const current = new Set(idsOf(active))

    const gone = previousIds.current.filter((id) => {
      return !current.has(id)
    })

    previousIds.current = [...current]

    if (gone.length === 0) {
      return
    }

    let isCancelled = false

    void fetchImagePage(imagePageKey({ ids: gone }))
      .then((result) => {
        if (isCancelled) {
          return
        }

        setFinished((records) => {
          return uniqBy([...result.items, ...records], 'id')
        })

        const stillActive = activeIdsOf(result.items)

        if (stillActive.length > 0) {
          previousIds.current = uniq([...previousIds.current, ...stillActive])
        }
      })
      .catch(() => {
        // The next active poll retries the terminal fetch.
        previousIds.current = uniq([...previousIds.current, ...gone])
      })

    return () => {
      isCancelled = true
    }
  }, [active, data, isHidden])

  const records = useMemo(() => {
    return uniqBy([...active, ...finished], 'id')
  }, [active, finished])

  if (!isHidden) {
    return { records: NO_RECORDS, activeCount: 0 }
  }

  return { records, activeCount: Math.max(data?.activeCount ?? 0, active.length) }
}
