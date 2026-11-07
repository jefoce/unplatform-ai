import { describe, expect, it } from 'vitest'

import { HISTORY_VIEWS } from '@/features/history/list/view-store'
import { INSTALL_KINDS, UPDATE_PHASES } from '@/lib/platform/update-schemas'

import { MODEL_STATUSES } from '../src/core/catalog'
import { FLATTEN_COLORS, IMAGE_FORMATS, MEDIA_KINDS } from '../src/core/media/media-types'
import { PRESET_ICONS } from '../src/core/presets/common/icon'
import { RESOLVED_TRANSPORTS, TRANSPORTS } from '../src/core/presets/common/transport'
import { VIDEO_FAMILIES } from '../src/core/presets/video/types'
import { GENERATOR_TABS, JOB_STATUSES, PRICE_SOURCES } from '../src/core/schemas/generation-record'
import { STATUS_HELP_KEYS } from '../src/core/status-help'
import {
  ACCOUNT_SOURCES,
  AUDIO_FILTERS,
  HISTORY_MODES,
  SECRET_SOURCES,
  STATUS_FILTERS,
} from '../src/core/types'

describe('shared value lists', () => {
  it('keeps the accepted values', () => {
    expect({
      MEDIA_KINDS,
      IMAGE_FORMATS,
      FLATTEN_COLORS,
      GENERATOR_TABS,
      JOB_STATUSES,
      PRICE_SOURCES,
      HISTORY_MODES,
      STATUS_FILTERS,
      AUDIO_FILTERS,
      ACCOUNT_SOURCES,
      SECRET_SOURCES,
      RESOLVED_TRANSPORTS,
      TRANSPORTS,
      VIDEO_FAMILIES,
      PRESET_ICONS,
      MODEL_STATUSES,
      STATUS_HELP_KEYS,
      INSTALL_KINDS,
      UPDATE_PHASES,
      HISTORY_VIEWS,
    }).toEqual({
      MEDIA_KINDS: ['image', 'video', 'audio'],
      IMAGE_FORMATS: ['jpeg', 'png'],
      FLATTEN_COLORS: ['#ffffff', '#1c1e20'],
      GENERATOR_TABS: ['frames', 'references'],
      JOB_STATUSES: [
        'submitting',
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired',
      ],
      PRICE_SOURCES: ['live', 'fallback', 'mock', 'unknown'],
      HISTORY_MODES: ['all', 'text', 'frames', 'references'],
      STATUS_FILTERS: ['all', 'done', 'active', 'failed'],
      AUDIO_FILTERS: ['any', 'on', 'off'],
      ACCOUNT_SOURCES: ['management', 'key', 'mock', 'none'],
      SECRET_SOURCES: ['env', 'keychain', 'file'],
      RESOLVED_TRANSPORTS: ['base64', 'url', 'upload'],
      TRANSPORTS: ['base64', 'url', 'upload', 'auto'],
      VIDEO_FAMILIES: ['wan', 'seedance', 'custom'],
      PRESET_ICONS: ['sparkles', 'audio-lines'],
      MODEL_STATUSES: ['available', 'unverified', 'missing', 'invalid', 'no_provider'],
      STATUS_HELP_KEYS: [
        'processing',
        'uploading',
        'sending',
        'pending',
        'generating',
        'downloading',
        'completed',
        'failed',
        'expired',
        'cancelled',
        'waiting_comfyui',
        'queued_n',
        'endpoint_unreachable',
      ],
      INSTALL_KINDS: ['macos', 'windows', 'appimage', 'linux-package', 'browser'],
      UPDATE_PHASES: ['downloading', 'installing'],
      HISTORY_VIEWS: ['list', 'grid', 'masonry'],
    })
  })
})
