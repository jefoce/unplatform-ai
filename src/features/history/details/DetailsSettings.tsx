import { isNil } from 'lodash-es'
import { Clock, Monitor, Volume2, VolumeX } from 'lucide-react'

import { findPreset } from '@/core/presets'
import { type ResolutionDisplay, resolutionDisplay } from '@/core/presets/common/display'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { formatSecondsShort } from '@/lib/format'
import { RatioIcon } from '@/ui/RatioIcon'

const SETTING_CLASSES =
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-lg bg-surface py-1.25 pl-1.5 pr-2.5 text-xxs font-semibold text-fg'

interface DetailsSettingsProps {
  record: GenerationRecord
}

/** Resolution, duration, ratio and audio chips for one record. */
export function DetailsSettings(props: DetailsSettingsProps) {
  const { record } = props
  const AudioIcon = record.input.audio ? Volume2 : VolumeX
  const aspect = record.input.aspectRatio === 'auto' ? 'Auto' : record.input.aspectRatio
  const audioLabel = record.input.audio ? 'Audio on' : 'Audio off'
  const preset = findPreset(record.input.presetId)
  let resolution: ResolutionDisplay = { label: record.input.resolution, detail: null }

  if (!isNil(preset)) {
    resolution = resolutionDisplay(preset, {
      resolution: record.input.resolution,
      aspect: record.input.aspectRatio,
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <span className={SETTING_CLASSES}>
        <Monitor size={14} className="text-fg-2" aria-hidden />
        {resolution.label}
        {!isNil(resolution.detail) && <span className="text-fg-2">{resolution.detail}</span>}
      </span>
      <span className={SETTING_CLASSES}>
        <Clock size={14} className="text-fg-2" aria-hidden />
        {formatSecondsShort(record.output?.durationSec ?? record.input.duration)}
      </span>
      <span className={SETTING_CLASSES}>
        <RatioIcon ratio={record.input.aspectRatio} />
        {aspect}
      </span>
      <span className={SETTING_CLASSES}>
        <AudioIcon size={14} className="text-fg-2" aria-hidden />
        {audioLabel}
      </span>
    </div>
  )
}
