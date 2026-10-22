'use client'

import { isNil } from 'lodash-es'
import useSWR from 'swr'

import type { BrowseResult } from '@/core/types'
import { Button } from '@/ui/Button'
import { Switch } from '@/ui/form/Switch'

import { fetchSystemCapabilities } from './api'

const NATIVE_LABELS: Record<string, string> = { darwin: 'Finder', win32: 'Explorer' }
const nativeLabel = (platform: string): string => NATIVE_LABELS[platform] ?? 'Files'

interface AddFolderFooterProps {
  data: BrowseResult | null
  isHidden: boolean
  isAdding: boolean
  isChoosing: boolean
  onAdd: () => void
  onChooseNative: () => void
  onClose: () => void
  onShowHidden: (isChecked: boolean) => void
}

/** Bottom controls for the add-folder dialog. */
export function AddFolderFooter(props: AddFolderFooterProps) {
  const { data, isHidden, isAdding, isChoosing, onAdd, onChooseNative, onClose, onShowHidden } =
    props
  const handleAdd = onAdd
  const handleChooseNative = onChooseNative
  const handleClose = onClose
  const handleShowHidden = onShowHidden
  const { data: capabilities } = useSWR('system-capabilities', fetchSystemCapabilities)

  return (
    <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {!isNil(capabilities) && capabilities.chooseFolder && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            loading={isChoosing}
            onClick={handleChooseNative}
          >
            {`Choose in ${nativeLabel(capabilities.platform)}`}
          </Button>
        )}
        <Switch
          id="show-hidden"
          checked={isHidden}
          onCheckedChange={handleShowHidden}
          label="Show hidden"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="h-9 text-xs"
          loading={isAdding}
          disabled={!data}
          onClick={handleAdd}
        >
          Add this folder
        </Button>
      </div>
    </div>
  )
}
