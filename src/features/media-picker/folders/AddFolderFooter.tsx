'use client'

import { isNil } from 'lodash-es'
import useSWR from 'swr'

import type { BrowseResult } from '@/core/media-types'
import type { Dict } from '@/core/utility-types'
import { fetchSystemCapabilities } from '@/lib/api/system'
import { Button } from '@/ui/Button'
import { Switch } from '@/ui/form/Switch'

const NATIVE_LABELS: Dict<string> = { darwin: 'Finder', win32: 'Explorer' }

const nativeLabel = (platform: string): string => {
  return NATIVE_LABELS[platform] ?? 'Files'
}

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
  const { data, isHidden, isAdding, isChoosing } = props
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
            onClick={props.onChooseNative}
          >
            {`Choose in ${nativeLabel(capabilities.platform)}`}
          </Button>
        )}
        <Switch
          id="show-hidden"
          checked={isHidden}
          onCheckedChange={props.onShowHidden}
          label="Show hidden"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={props.onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="h-9 text-xs"
          loading={isAdding}
          disabled={!data}
          onClick={props.onAdd}
        >
          Add this folder
        </Button>
      </div>
    </div>
  )
}
