import type { AspectChoice, Resolution } from './presets/types'
import type {
  GenerationRecord,
  GeneratorTab,
  JobStatus,
  PriceSource,
} from './schemas/generation-record'
import type { SecretName } from './secret-names'
import type { Dict } from './utility-types'

/** Start and end frame data URLs. */
export interface FrameSlots {
  start: string | null
  end: string | null
}

export const ACTIVE_STATUSES: JobStatus[] = ['submitting', 'pending', 'in_progress']

/** One id a batch route could not act on, with the reason. */
export interface BatchSkip {
  id: string
  reason: 'not_found' | 'active' | 'not_ready'
}

export const HISTORY_MODES = ['all', 'text', 'frames', 'references'] as const

export type HistoryMode = (typeof HISTORY_MODES)[number]

export const STATUS_FILTERS = ['all', 'done', 'active', 'failed'] as const

export type StatusFilter = (typeof STATUS_FILTERS)[number]

export type ResolutionFilter = Resolution | 'all'
export type AspectFilter = AspectChoice | 'all'

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

export interface GenerationListResult {
  items: GenerationRecord[]
  nextCursor: string | null
  activeCount: number
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

export type SecretBackend = Exclude<SecretSource, 'env'> | null

/** Stored key status, without values. */
export interface SecretStatus {
  backend: SecretBackend
  loading: boolean
  loadError: string | null
  keys: Record<SecretName, SecretKeyStatus>
}

/** Server price for one draft, discounted and at list. */
export interface GenerationEstimate {
  estimatedUsd: number
  listUsd: number
  pricePerSec: number
  priceSource: PriceSource
  discount: number
}

/** Live and list SKU rates for one preset. */
export interface PricingInfo {
  skus: Dict<number>
  listSkus: Dict<number>
  discount: number
  source: Exclude<PriceSource, 'unknown'>
  fetchedAt: string
}

/** Result of a stored credential test. */
export interface TestResult {
  ok: boolean
  mock?: boolean
  label?: string
  error?: string
}
