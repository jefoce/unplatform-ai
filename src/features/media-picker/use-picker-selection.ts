'use client'

import { useCallback, useState } from 'react'
import { isEmpty } from 'lodash-es'

import type { UploadItem } from '@/core/types'

import { closeMediaPicker, type PickerRequest, useMediaPickerStore } from './store'

export interface PickerSelection {
  selected: UploadItem[]
  commit: (items: UploadItem[]) => void
  confirm: () => void
  removeSelected: (id: string) => void
}

/** Selected uploads and the picker commit rules. */
export function usePickerSelection(request: PickerRequest): PickerSelection {
  const [selected, setSelected] = useState<UploadItem[]>([])

  const commit = useCallback(
    (items: UploadItem[]) => {
      if (request !== useMediaPickerStore.getState().request) return

      const allowed = items.filter(
        (item) => item.missing !== true && request.kinds.includes(item.kind),
      )

      if (isEmpty(allowed)) return

      if (request.max === 1) {
        request.onPick([allowed[0]])
        closeMediaPicker()

        return
      }

      setSelected((previous) => {
        const next = [...previous]

        for (const item of allowed) {
          const index = next.findIndex((entry) => entry.id === item.id)

          if (index >= 0) {
            next.splice(index, 1)
            continue
          }

          if (next.length < request.max) next.push(item)
        }

        return next
      })
    },
    [request],
  )

  const confirm = useCallback(() => {
    request.onPick(selected)
    closeMediaPicker()
  }, [request, selected])

  const removeSelected = useCallback((id: string) => {
    setSelected((previous) => previous.filter((item) => item.id !== id))
  }, [])

  return { selected, commit, confirm, removeSelected }
}
