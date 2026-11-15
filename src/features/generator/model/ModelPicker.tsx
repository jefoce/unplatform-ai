'use client'

import { useEffect, useMemo } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import type { CatalogEntry } from '@/core/catalog'
import type { PickerModel } from '@/core/feed/picker-model'
import { findPreset, VIDEO_PRESETS } from '@/core/presets'
import type { PresetIcon } from '@/core/presets/common/icon'
import { findImagePreset } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useCatalog } from '@/lib/api/catalog'
import { useBoolean } from '@/lib/use-boolean'
import { useMediaQuery } from '@/lib/use-media-query'
import { Popover } from '@/ui/Popover'

import { useGeneratorStore } from '../store/store'
import type { RememberModelParams } from '../store/store-state'
import { ModelPickerContent } from './ModelPickerContent'
import { ModelPickerTrigger, type ModelPickerVariant } from './ModelPickerTrigger'
import { pickerGroups, type PickerKind, type PickerRow } from './picker-groups'
import { currentRow, fallbackRow } from './picker-view'
import { presetTitleOf } from './preset-title'
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

function triggerTitle(row: PickerRow, isCatalogLoading: boolean): string {
  if (!isEmpty(row.title)) {
    if (isNil(row.badge)) {
      return row.title
    }

    return `[${row.badge}] ${row.title}`
  }

  if (isCatalogLoading) {
    return 'Loading model…'
  }

  return 'Model unavailable'
}

interface ResolvedModelParams {
  entry: CatalogEntry | null
  selectedId: string
}

interface ResolvedModel {
  title: string | null
  badge: string | null
  icon: PresetIcon
}

interface ResolvedTitleParams {
  entry: CatalogEntry | null
  selectedId: string
  preset: VideoPreset | ImagePreset | null
}

function resolvedTitle(params: ResolvedTitleParams): string | null {
  const { entry, selectedId, preset } = params
  const entryTitle = entry?.preset?.title

  if (!isNil(entryTitle)) {
    return entryTitle
  }

  const remembered = presetTitleOf(selectedId)

  if (!isNil(remembered)) {
    return remembered
  }

  return preset?.title ?? null
}

function resolvedModel(params: ResolvedModelParams): ResolvedModel {
  const { entry, selectedId } = params
  const preset = entry?.preset ?? findPreset(selectedId) ?? findImagePreset(selectedId)
  const title = resolvedTitle({ entry, selectedId, preset })
  const badge = entry?.source.badge ?? null
  const icon = preset?.icon ?? 'sparkles'

  return { title, badge, icon }
}

interface PickerDraft {
  presetId: string
  setPreset: (id: string) => void
  rememberModel: (params: RememberModelParams) => void
  savedTitle: string | null
  savedBadge: string | null
  savedIcon: PresetIcon
  aspectRatio: string
}

function usePickerDraft(isImage: boolean): PickerDraft {
  const video = useGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        setPreset: state.setPreset,
        rememberModel: state.rememberModel,
        savedTitle: state.modelTitle,
        savedBadge: state.modelBadge,
        savedIcon: state.modelIcon,
        aspectRatio: state.aspectRatio,
      }
    }),
  )

  const image = useImageGeneratorStore(
    useShallow((state) => {
      return {
        presetId: state.presetId,
        setPreset: state.setPreset,
        rememberModel: state.rememberModel,
        savedTitle: state.modelTitle,
        savedBadge: state.modelBadge,
        savedIcon: state.modelIcon,
      }
    }),
  )

  const active = isImage ? image : video

  return { ...active, aspectRatio: video.aspectRatio }
}

interface RememberedModelParams {
  selectedId: string
  entry: CatalogEntry | null
  savedTitle: string | null
  savedBadge: string | null
  savedIcon: PresetIcon
  rememberModel: (params: RememberModelParams) => void
}

function useRememberedModel(params: RememberedModelParams): void {
  const { selectedId, entry, savedTitle, savedBadge, savedIcon, rememberModel } = params
  const resolved = resolvedModel({ entry, selectedId })

  useEffect(() => {
    if (isNil(resolved.title)) {
      return
    }

    const isUnchanged =
      resolved.title === savedTitle && resolved.badge === savedBadge && resolved.icon === savedIcon

    if (isUnchanged) {
      return
    }

    rememberModel({
      id: selectedId,
      title: resolved.title,
      badge: resolved.badge,
      icon: resolved.icon,
    })
  }, [
    selectedId,
    resolved.title,
    resolved.badge,
    resolved.icon,
    savedTitle,
    savedBadge,
    savedIcon,
    rememberModel,
  ])
}

interface ModelPickerProps {
  models?: readonly PickerModel[]
  selectedId?: string
  onSelect?: (id: string) => void
  variant?: ModelPickerVariant
  kind?: PickerKind
}

/** Preset picker with search, provider groups, prices and a refresh control. */
/* eslint-disable-next-line max-lines-per-function, complexity -- one picker owns both draft stores */
export function ModelPicker(props: ModelPickerProps) {
  const modelMenu = useBoolean()
  const refresh = useCatalogRefresh()
  const isWide = useMediaQuery('(min-width: 900px)')

  const kind = props.kind ?? 'video'
  const draft = usePickerDraft(kind === 'image')
  const { catalog, isValidating } = useCatalog()

  const selectedId = props.selectedId ?? draft.presetId
  const isBar = props.variant === 'bar'
  const isFetching = refresh.isFetching || isValidating
  const aspect = pickerAspect(kind, draft.aspectRatio)

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

  const current =
    currentRow(groups, selectedId) ??
    fallbackRow({
      selectedId,
      entry,
      savedTitle: draft.savedTitle,
      savedBadge: draft.savedBadge,
      savedIcon: draft.savedIcon,
    })

  useRememberedModel({
    selectedId,
    entry,
    savedTitle: draft.savedTitle,
    savedBadge: draft.savedBadge,
    savedIcon: draft.savedIcon,
    rememberModel: draft.rememberModel,
  })

  const isCatalogLoading = isNil(catalog) || isValidating

  const handleOpenChange = (isOpen: boolean): void => {
    modelMenu.set(isOpen)

    if (isOpen) {
      refresh.refresh()
    }
  }

  const handleSelectPreset = (id: string): void => {
    if (isNil(props.onSelect)) {
      draft.setPreset(id)
    } else {
      props.onSelect(id)
    }

    const row = currentRow(groups, id)

    if (!isNil(row)) {
      draft.rememberModel({ id, title: row.title, badge: row.badge ?? null, icon: row.icon })
    }

    modelMenu.off()
  }

  const picker = (
    <Popover open={modelMenu.value} onOpenChange={handleOpenChange}>
      <ModelPickerTrigger
        model={current}
        title={triggerTitle(current, isCatalogLoading)}
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
