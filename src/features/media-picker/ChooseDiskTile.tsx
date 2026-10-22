'use client'

import { useCallback, useState } from 'react'
import { isEmpty } from 'lodash-es'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

import type { MediaKind, UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { getPlatform } from '@/lib/platform'
import { Spinner } from '@/ui/Spinner'

import type { PickerExtensions } from './store'

interface ChooseDiskTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  onUploaded: (items: UploadItem[]) => void
}

/** Native file picker tile for desktop builds. */
export function ChooseDiskTile(props: ChooseDiskTileProps) {
  const { kinds, max, extensions, onUploaded } = props
  const [isBusy, setIsBusy] = useState(false)

  const pick = useCallback(async () => {
    setIsBusy(true)

    try {
      const items = await (
        await getPlatform()
      ).chooseFiles({ kinds, multiple: max > 1, extensions })

      if (isEmpty(items)) return

      onUploaded(items)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }, [extensions, kinds, max, onUploaded])

  const handlePick = useCallback(() => void pick(), [pick])

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={handlePick}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-divider bg-white/2 text-xs font-medium text-fg-2 transition hover:bg-white/4 disabled:opacity-60"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-white/10">
        {isBusy ? <Spinner size={16} /> : <FolderOpen className="size-5" aria-hidden />}
      </span>
      <span>{isBusy ? 'Choosing...' : 'Choose from disk'}</span>
    </button>
  )
}
