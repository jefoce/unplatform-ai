import { describe, expect, it } from 'vitest'

import { MODEL_STATUSES } from '@/core/catalog'
import { FLATTEN_COLORS, IMAGE_FORMATS, MEDIA_KINDS } from '@/core/media-types'
import {
  PRESET_FAMILIES,
  PRESET_ICONS,
  RESOLVED_TRANSPORTS,
  TRANSPORTS,
} from '@/core/presets/types'
import { GENERATOR_TABS, JOB_STATUSES, PRICE_SOURCES } from '@/core/schemas/generation-record'
import { STATUS_HELP_KEYS } from '@/core/status-help'
import {
  ACCOUNT_SOURCES,
  AUDIO_FILTERS,
  HISTORY_MODES,
  SECRET_SOURCES,
  STATUS_FILTERS,
} from '@/core/types'
import { HISTORY_VIEWS } from '@/features/history/list/view-store'
import { INSTALL_KINDS, UPDATE_PHASES } from '@/lib/platform/update-schemas'

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
      PRESET_FAMILIES,
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
      RESOLVED_TRANSPORTS: ['base64', 'url'],
      TRANSPORTS: ['base64', 'url', 'auto'],
      PRESET_FAMILIES: ['wan', 'seedance'],
      PRESET_ICONS: ['sparkles', 'audio-lines'],
      MODEL_STATUSES: ['available', 'unverified', 'missing', 'no_provider'],
      STATUS_HELP_KEYS: [
        'processing',
        'uploading',
        'sending',
        'in_queue',
        'generating',
        'downloading',
        'completed',
        'failed',
        'expired',
        'cancelled',
      ],
      INSTALL_KINDS: ['macos', 'windows', 'appimage', 'linux-package', 'browser'],
      UPDATE_PHASES: ['downloading', 'installing'],
      HISTORY_VIEWS: ['list', 'grid'],
    })
  })
})
