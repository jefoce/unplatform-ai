'use client'

import { useEffect, useMemo } from 'react'

import { fetchUploads } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

import { useGeneratorStore } from '../store/store'

/**
 * Refreshes cached uploads for attached frames and references on focus.
 */
export function useUploadsRefresh() {
  const frames = useGeneratorStore((state) => {
    return state.frames
  })

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const idsKey = useMemo(() => {
    return [...new Set([frames.start, frames.end, ...references])]
      .filter((id): id is string => {
        return Boolean(id)
      })
      .sort()
      .join(',')
  }, [frames.start, frames.end, references])

  useEffect(() => {
    const refresh = () => {
      const ids = idsKey.split(',').filter(Boolean)

      if (ids.length === 0) {
        return
      }

      void fetchUploads({ ids })
        .then((items) => {
          useGeneratorStore.getState().upsertUploads(items)
        })
        .catch((error) => {
          toastError(error)
        })
    }

    refresh()
    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
    }
  }, [idsKey])
}
