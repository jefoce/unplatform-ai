import { isNil } from 'lodash-es'
import { Clock, Monitor, Volume2, VolumeX } from 'lucide-react'

import { findPreset } from '@/core/presets'
import { resolutionDisplay, resolutionHeight } from '@/core/presets/common/display'
import type { VideoPreset } from '@/core/presets/video/types'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { formatSecondsShort } from '@/lib/format'
import { RatioIcon } from '@/ui/RatioIcon'

const SETTING_CLASSES =
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-lg bg-surface py-1.25 pl-1.5 pr-2.5 text-xxs font-semibold text-fg'

interface DetailsSettingsProps {
  record: GenerationRecord
}

interface ResolutionSettingParams {
  preset: VideoPreset | null
  resolution: string
  aspect: string
}

interface ResolutionSetting {
  compact: string | null
  label: string
  detail: string | null
  title: string | undefined
}

function resolutionSetting(params: ResolutionSettingParams): ResolutionSetting {
  const { preset, resolution, aspect } = params

  if (isNil(preset)) {
    return { compact: null, label: resolution, detail: null, title: undefined }
  }

  const display = resolutionDisplay(preset, { resolution, aspect })
  const compact = resolutionHeight(preset, { resolution, aspect })
  let title: string | undefined

  if (!isNil(compact)) {
    let suffix = ''

    if (!isNil(display.detail)) {
      suffix = ` \u00b7 ${display.detail}`
    }

    title = `${display.label}${suffix}`
  }

  return { compact, label: display.label, detail: display.detail, title }
}

/** Resolution, duration, ratio and audio chips for one record. */
export function DetailsSettings(props: DetailsSettingsProps) {
  const { record } = props
  const AudioIcon = record.input.audio ? Volume2 : VolumeX
  const aspect = record.input.aspectRatio === 'auto' ? 'Auto' : record.input.aspectRatio
  const audioLabel = record.input.audio ? 'Audio on' : 'Audio off'

  const setting = resolutionSetting({
    preset: findPreset(record.input.presetId),
    resolution: record.input.resolution,
    aspect: record.input.aspectRatio,
  })

  return (
    <div className="flex flex-wrap gap-2">
      <span className={SETTING_CLASSES} title={setting.title}>
        <Monitor size={14} className="text-fg-2" aria-hidden />
        {!isNil(setting.compact) && setting.compact}
        {isNil(setting.compact) && setting.label}
        {isNil(setting.compact) && !isNil(setting.detail) && (
          <span className="text-fg-2">{setting.detail}</span>
        )}
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
