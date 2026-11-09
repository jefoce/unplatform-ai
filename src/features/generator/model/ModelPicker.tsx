'use client'

import { useMemo } from 'react'
import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'
import { VIDEO_PRESETS } from '@/core/presets'
import { useCatalog } from '@/lib/api/catalog'
import { useBoolean } from '@/lib/use-boolean'
import { useMediaQuery } from '@/lib/use-media-query'
import { Popover } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import { ModelPickerContent } from './ModelPickerContent'
import { ModelPickerTrigger, type ModelPickerVariant } from './ModelPickerTrigger'
import { pickerGroups, type PickerKind } from './picker-groups'
import { currentRow, fallbackRow } from './picker-view'
import { useCatalogRefresh } from './use-catalog-refresh'
import { videoPickerModel } from './video-picker-model'

const VIDEO_MODELS = VIDEO_PRESETS.map((preset) => {
  return videoPickerModel(preset, null)
})

function pickerAspect(kind: PickerKind, aspect: string): string | undefined {
  if (kind === 'image') {
    return undefined
  }

  return aspect
}

interface ModelPickerProps {
  models?: readonly PickerModel[]
  selectedId?: string
  onSelect?: (id: string) => void
  variant?: ModelPickerVariant
  kind?: PickerKind
}

/** Preset picker with search, provider groups, prices and a refresh control. */
export function ModelPicker(props: ModelPickerProps) {
  const modelMenu = useBoolean()
  const refresh = useCatalogRefresh()
  const isWide = useMediaQuery('(min-width: 900px)')

  const presetId = useGeneratorStore((state) => {
    return state.presetId
  })

  const setPreset = useGeneratorStore((state) => {
    return state.setPreset
  })

  const videoAspect = useGeneratorStore((state) => {
    return state.aspectRatio
  })

  const { catalog, isValidating } = useCatalog()

  const selectedId = props.selectedId ?? presetId
  const isBar = props.variant === 'bar'
  const isFetching = refresh.isFetching || isValidating
  const kind = props.kind ?? 'video'
  const aspect = pickerAspect(kind, videoAspect)

  const groups = useMemo(() => {
    return pickerGroups({
      models: props.models ?? VIDEO_MODELS,
      entries: catalog?.entries ?? [],
      kind,
      aspect,
    })
  }, [props.models, kind, catalog, aspect])

  const entries = useMemo(() => {
    const map = new Map<string, CatalogEntry>()

    for (const entry of catalog?.entries ?? []) {
      map.set(entry.presetId, entry)
    }

    return map
  }, [catalog])

  const entry = entries.get(selectedId) ?? null
  const current = currentRow(groups, selectedId) ?? fallbackRow({ selectedId, entry })

  const handleOpenChange = (isOpen: boolean): void => {
    modelMenu.set(isOpen)

    if (isOpen) {
      refresh.refresh()
    }
  }

  const handleSelectPreset = (id: string): void => {
    if (isNil(props.onSelect)) {
      setPreset(id)
    } else {
      props.onSelect(id)
    }

    modelMenu.off()
  }

  const picker = (
    <Popover open={modelMenu.value} onOpenChange={handleOpenChange}>
      <ModelPickerTrigger
        model={current}
        discount={entry?.pricing?.discount ?? 0}
        variant={props.variant}
      />
      <ModelPickerContent
        groups={groups}
        entries={entries}
        selectedId={selectedId}
        isBar={isBar}
        isWide={isWide}
        isFetching={isFetching}
        onRefresh={refresh.forceRefresh}
        onSelect={handleSelectPreset}
      />
    </Popover>
  )

  if (isBar) {
    return picker
  }

  return <div className="mt-4">{picker}</div>
}
