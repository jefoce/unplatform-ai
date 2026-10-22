'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { uploadFilesWithProgress } from './api'
import type { UploadProgressItem } from './UploadProgressTile'

export interface UploadQueue {
  items: UploadProgressItem[]
  enqueue: (files: File[]) => void
  retry: (id: string) => void
  dismiss: (id: string) => void
  clear: () => void
}

/** Copies queued files one by one and tracks per-file progress. */
export function useUploadQueue(
  onUploaded: (items: UploadItem[]) => void,
  onError?: (message: string) => void,
): UploadQueue {
  const [items, setItems] = useState<UploadProgressItem[]>([])
  const nextId = useRef(0)
  const controllers = useRef(new Map<string, AbortController>())

  const run = useCallback(
    async (entry: UploadProgressItem) => {
      const controller = new AbortController()

      controllers.current.set(entry.id, controller)
      const patch = (change: Partial<UploadProgressItem>) =>
        setItems((previous) =>
          previous.map((item) => {
            if (item.id !== entry.id) return item

            return { ...item, ...change }
          }),
        )

      patch({ progress: 0, error: undefined })

      try {
        const uploaded = await uploadFilesWithProgress({
          files: [entry.file],
          onProgress: (sent, total) => {
            patch({ progress: total > 0 ? Math.round((sent / total) * 100) : 0 })
          },
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        setItems((previous) => previous.filter((item) => item.id !== entry.id))
        onUploaded(uploaded)
      } catch (error) {
        if (controller.signal.aborted) return

        if (onError) {
          setItems((previous) => previous.filter((item) => item.id !== entry.id))
          onError(errorMessage(error))

          return
        }

        patch({ error: errorMessage(error) })
      } finally {
        controllers.current.delete(entry.id)
      }
    },
    [onUploaded, onError],
  )

  const enqueue = useCallback(
    (files: File[]) => {
      const entries = files.map((file) => ({
        id: `upload-${(nextId.current += 1)}`,
        file,
        progress: 0,
      }))

      setItems((previous) => [...previous, ...entries])

      for (const entry of entries) void run(entry)
    },
    [run],
  )

  const retry = useCallback(
    (id: string) => {
      const entry = items.find((item) => item.id === id)

      if (entry) void run(entry)
    },
    [items, run],
  )

  const dismiss = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort()

    controllers.current.clear()
    setItems([])
  }, [])

  useEffect(() => {
    const active = controllers.current

    return () => {
      for (const controller of active.values()) controller.abort()

      active.clear()
    }
  }, [])

  return { items, enqueue, retry, dismiss, clear }
}
