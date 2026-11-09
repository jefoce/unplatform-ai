'use client'

import { isNil } from 'lodash-es'
import { Layers2, Monitor, Sparkles, Square, SquareDashed, Wand2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { imageResolutionChoices, imageResolutionDisplay } from '@/core/presets/common/display'
import type {
  ImageAspectChoice,
  ImageBackground,
  ImageOption,
  ImagePreset,
} from '@/core/presets/image/types'
import { OptionPopover } from '@/ui/OptionPopover'
import { RatioIcon } from '@/ui/RatioIcon'

import { useImageGeneratorStore } from '../store'
import { ImageSeedChip } from './ImageSeedChip'

const BACKGROUND_ICONS: Record<ImageBackground, ReactNode> = {
  auto: <Wand2 size={14} aria-hidden />,
  opaque: <Square size={14} aria-hidden />,
  transparent: <SquareDashed size={14} aria-hidden />,
}

function valuesOf<T extends string>(options: readonly ImageOption<T>[]): T[] {
  return options.map((option) => {
    return option.value
  })
}

function labelsOf<T extends string>(
  options: readonly ImageOption<T>[],
): Partial<Record<T, string>> {
  return options.reduce<Partial<Record<T, string>>>((labels, option) => {
    labels[option.value] = option.label

    return labels
  }, {})
}

function aspectLabel(value: ImageAspectChoice): string {
  if (value === 'auto') {
    return 'Auto'
  }

  return value
}

function aspectIcon(value: ImageAspectChoice): ReactNode {
  return <RatioIcon ratio={value} size={14} />
}

function backgroundIcon(value: ImageBackground): ReactNode {
  return BACKGROUND_ICONS[value]
}

function resolutionIcon(): ReactNode {
  return <Monitor size={14} aria-hidden />
}

function resolutionDetailFor(
  preset: ImagePreset,
  aspect: string,
): (value: string) => string | null {
  return (value) => {
    return imageResolutionDisplay(preset, { resolution: value, aspect }).detail
  }
}

interface ImageOptionsRowProps {
  preset: ImagePreset
}

/** Resolution, aspect, quality and background chips from the active preset. */
export function ImageOptionsRow(props: ImageOptionsRowProps) {
  const { preset } = props

  const aspectRatio = useImageGeneratorStore((state) => {
    return state.aspectRatio
  })

  const resolution = useImageGeneratorStore((state) => {
    return state.resolution
  })

  const quality = useImageGeneratorStore((state) => {
    return state.quality
  })

  const background = useImageGeneratorStore((state) => {
    return state.background
  })

  const setAspectRatio = useImageGeneratorStore((state) => {
    return state.setAspectRatio
  })

  const setResolution = useImageGeneratorStore((state) => {
    return state.setResolution
  })

  const setQuality = useImageGeneratorStore((state) => {
    return state.setQuality
  })

  const setBackground = useImageGeneratorStore((state) => {
    return state.setBackground
  })

  const aspects: ImageOption<ImageAspectChoice>[] = preset.aspectRatios.map((value) => {
    return { value, label: aspectLabel(value) }
  })

  const resolutionChoices = imageResolutionChoices(preset, aspectRatio)
  const resolutionDetail = resolutionDetailFor(preset, aspectRatio)

  return (
    <>
      <OptionPopover
        label="Aspect"
        options={valuesOf(aspects)}
        labels={labelsOf(aspects)}
        value={aspectRatio}
        onValueChange={setAspectRatio}
        icon={<RatioIcon ratio={aspectRatio} size={14} />}
        optionIcon={aspectIcon}
      />

      {!isNil(preset.resolutions) && !isNil(resolution) && (
        <OptionPopover
          label="Resolution"
          options={valuesOf(resolutionChoices)}
          labels={labelsOf(resolutionChoices)}
          value={resolution}
          onValueChange={setResolution}
          icon={<Monitor size={14} aria-hidden />}
          optionIcon={resolutionIcon}
          optionDetail={resolutionDetail}
        />
      )}

      {!isNil(preset.qualities) && !isNil(quality) && (
        <OptionPopover
          label="Quality"
          options={valuesOf(preset.qualities)}
          labels={labelsOf(preset.qualities)}
          value={quality}
          onValueChange={setQuality}
          icon={<Sparkles size={14} aria-hidden />}
        />
      )}

      {!isNil(preset.backgrounds) && !isNil(background) && (
        <OptionPopover
          label="Background"
          options={valuesOf(preset.backgrounds)}
          labels={labelsOf(preset.backgrounds)}
          value={background}
          onValueChange={setBackground}
          icon={<Layers2 size={14} aria-hidden />}
          optionIcon={backgroundIcon}
        />
      )}

      <ImageSeedChip />
    </>
  )
}
