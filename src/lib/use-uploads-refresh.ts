'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { isNil, uniq } from 'lodash-es'

import type { UploadItem } from '@/core/schemas/upload-item'
import { fetchUploads } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

interface UseUploadsRefreshParams {
  ids: string[]
  upsert: (items: UploadItem[]) => void
  onMissing?: (ids: string[]) => void
}

/**
 * Refreshes cached uploads on mount and focus.
 * Calls `onMissing` with requested ids the server did not return.
 * Returns true until the first refresh settles.
 */
export function useUploadsRefresh(params: UseUploadsRefreshParams): boolean {
  const { ids, upsert, onMissing } = params
  const [isLoading, setIsLoading] = useState(false)
  const didLoad = useRef(false)

  const idsKey = useMemo(() => {
    return uniq(ids)
      .filter((id): id is string => {
        return Boolean(id)
      })
      .sort()
      .join(',')
  }, [ids])

  useEffect(() => {
    const refresh = () => {
      const requested = idsKey.split(',').filter(Boolean)

      if (requested.length === 0) {
        return
      }

      const isFirstLoad = !didLoad.current

      if (isFirstLoad) {
        setIsLoading(true)
      }

      void fetchUploads({ ids: requested })
        .then((items) => {
          upsert(items)

          if (isNil(onMissing)) {
            return
          }

          const found = new Set(
            items.map((item) => {
              return item.id
            }),
          )

          const missing = requested.filter((id) => {
            return !found.has(id)
          })

          if (missing.length > 0) {
            onMissing(missing)
          }
        })
        .catch((error) => {
          toastError(error)
        })
        .finally(() => {
          didLoad.current = true

          if (isFirstLoad) {
            setIsLoading(false)
          }
        })
    }

    refresh()
    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
    }
  }, [idsKey, upsert, onMissing])

  return isLoading
}
