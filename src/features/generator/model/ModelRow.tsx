'use client'

import { useMemo } from 'react'
import { isNil } from 'lodash-es'

import { findPreset } from '@/core/presets'
import { findImagePreset } from '@/core/presets/image'
import { useModelEntry } from '@/lib/api/models'

import { imagePickerModel } from './image-picker-model'
import type { ModelRowProps } from './model-row-props'
import { ModelCustomRow } from './ModelCustomRow'
import { ModelGenericRow } from './ModelGenericRow'
import { ModelVideoRow } from './ModelVideoRow'
import { videoPickerModel } from './video-picker-model'

/** One selectable row in the model picker, video or image. */
export function ModelRow(props: ModelRowProps) {
  const entry = useModelEntry(props.model.id)
  const preset = findPreset(props.model.id)
  const skus = entry?.pricing?.skus

  const imagePreset = useMemo(() => {
    if (!isNil(preset)) {
      return null
    }

    return findImagePreset(props.model.id)
  }, [preset, props.model.id])

  const imageModel = useMemo(() => {
    if (isNil(imagePreset)) {
      return null
    }

    return imagePickerModel(imagePreset, skus)
  }, [imagePreset, skus])

  if (props.model.isCustom === true) {
    return <ModelCustomRow {...props} />
  }

  if (isNil(preset)) {
    if (isNil(imagePreset) || isNil(imageModel)) {
      return <ModelGenericRow {...props} />
    }

    return <ModelGenericRow {...props} model={imageModel} entry={entry} />
  }

  const view = videoPickerModel(preset, entry)

  return (
    <ModelVideoRow
      model={view}
      preset={preset}
      entry={entry}
      selected={props.selected}
      onSelect={props.onSelect}
    />
  )
}
