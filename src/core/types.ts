import type { z } from 'zod'

import type { FrameSlotsSchema, GeneratorTab, JobStatus } from './schemas/generation-record'
import type { SecretName } from './secret-names'

/** Start and end frame data URLs. */
export type FrameSlots = z.infer<typeof FrameSlotsSchema>

export const ACTIVE_STATUSES: JobStatus[] = ['submitting', 'pending', 'in_progress']

export const TERMINAL_STATUSES: readonly JobStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'expired',
]

export const HISTORY_MODES = ['all', 'text', 'frames', 'references'] as const

export type HistoryMode = (typeof HISTORY_MODES)[number]

export const STATUS_FILTERS = ['all', 'done', 'active', 'failed'] as const

export type StatusFilter = (typeof STATUS_FILTERS)[number]

export type ResolutionFilter = string
export type AspectFilter = string

export const AUDIO_FILTERS = ['any', 'on', 'off'] as const

export type AudioFilter = (typeof AUDIO_FILTERS)[number]

export interface HistoryFilters {
  q?: string
  model?: string
  favorite?: boolean
  status?: StatusFilter
  tab?: GeneratorTab | 'all'
  mode?: HistoryMode
  resolution?: ResolutionFilter
  aspect?: AspectFilter
  audio?: AudioFilter
}

export const ACCOUNT_SOURCES = ['management', 'key', 'mock', 'none'] as const

export type AccountSource = (typeof ACCOUNT_SOURCES)[number]

export interface CreditsInfo {
  balance: number | null
  keyLimitRemaining: number | null
  keyLimit: number | null
  usageDaily: number | null
  usageMonthly: number | null
  localSpent: number
  localSpentUnknown: number
  source: AccountSource
  fetchedAt: string
  error?: string
}

/** OS dialog support for the current server. */
export interface SystemCapabilities {
  chooseFiles: boolean
  chooseFolder: boolean
  platform: string
}

export const SECRET_SOURCES = ['env', 'keychain', 'file'] as const

export type SecretSource = (typeof SECRET_SOURCES)[number]

export interface SecretKeyStatus {
  set: boolean
  source: SecretSource | null
  hint: string | null
}

export type SecretBackendKind = Exclude<SecretSource, 'env'> | null

/** Stored key status, without values. */
export interface SecretStatus {
  backend: SecretBackendKind
  loading: boolean
  loadError: string | null
  keys: Record<SecretName, SecretKeyStatus>
}

/** Result of a stored credential test. */
export interface TestResult {
  ok: boolean
  mock?: boolean
  label?: string
  error?: string
}
