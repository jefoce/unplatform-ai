'use client'

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { messageOf } from '@/core/errors'
import type { UploadItem } from '@/core/schemas/upload-item'
import { uploadFilesWithProgress } from '@/lib/api/uploads'

import type { UploadProgressItem } from './UploadProgressTile'

export interface UploadQueue {
  items: UploadProgressItem[]
  enqueue: (files: File[]) => void
  retry: (id: string) => void
  dismiss: (id: string) => void
  clear: () => void
}

interface RunUploadParams {
  entry: UploadProgressItem
  controllers: RefObject<Map<string, AbortController>>
  setItems: Dispatch<SetStateAction<UploadProgressItem[]>>
  onUploaded: (items: UploadItem[]) => void
  onError?: (message: string) => void
}

async function runUpload(params: RunUploadParams): Promise<void> {
  const { entry, controllers, setItems, onUploaded, onError } = params
  const controller = new AbortController()

  controllers.current.set(entry.id, controller)

  const patch = (change: Partial<UploadProgressItem>) => {
    setItems((previous) => {
      return previous.map((item) => {
        if (item.id !== entry.id) {
          return item
        }

        return { ...item, ...change }
      })
    })
  }

  patch({ progress: 0, error: undefined })

  try {
    const uploaded = await uploadFilesWithProgress({
      files: [entry.file],
      onProgress: (sent, total) => {
        if (total <= 0) {
          patch({ progress: 0 })

          return
        }

        patch({ progress: Math.round((sent / total) * 100) })
      },
      signal: controller.signal,
    })

    if (controller.signal.aborted) {
      return
    }

    setItems((previous) => {
      return previous.filter((item) => {
        return item.id !== entry.id
      })
    })

    onUploaded(uploaded)
  } catch (error) {
    if (controller.signal.aborted) {
      return
    }

    if (onError) {
      setItems((previous) => {
        return previous.filter((item) => {
          return item.id !== entry.id
        })
      })

      onError(messageOf(error))

      return
    }

    patch({ error: messageOf(error) })
  } finally {
    controllers.current.delete(entry.id)
  }
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
    (entry: UploadProgressItem) => {
      return runUpload({ entry, controllers, setItems, onUploaded, onError })
    },
    [onUploaded, onError],
  )

  const enqueue = useCallback(
    (files: File[]) => {
      const entries = files.map((file) => {
        return {
          id: `upload-${(nextId.current += 1)}`,
          file,
          progress: 0,
        }
      })

      setItems((previous) => {
        return [...previous, ...entries]
      })

      for (const entry of entries) {
        void run(entry)
      }
    },
    [run],
  )

  const retry = useCallback(
    (id: string) => {
      const entry = items.find((item) => {
        return item.id === id
      })

      if (entry) {
        void run(entry)
      }
    },
    [items, run],
  )

  const dismiss = useCallback((id: string) => {
    setItems((previous) => {
      return previous.filter((item) => {
        return item.id !== id
      })
    })
  }, [])

  const clear = useCallback(() => {
    for (const controller of controllers.current.values()) {
      controller.abort()
    }

    controllers.current.clear()
    setItems([])
  }, [])

  useEffect(() => {
    const active = controllers.current

    return () => {
      for (const controller of active.values()) {
        controller.abort()
      }

      active.clear()
    }
  }, [])

  return { items, enqueue, retry, dismiss, clear }
}
