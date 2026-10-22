import type { UploadItem } from './media-types'
import type { AspectChoice, Resolution } from './presets'
import type { SecretName } from './secret-names'

export type {
  BrowseResult,
  FolderDir,
  FolderFile,
  FolderItem,
  FolderListing,
  LinkMode,
  MediaKind,
  ReferencePlan,
  UploadItem,
} from './media-types'

export type GeneratorTab = 'frames' | 'references'

/** Exact generate panel state. Saved in record, copied back by Rerun. */
export interface GenerationInput {
  presetId: string
  tab: GeneratorTab
  prompt: string
  audio: boolean
  duration: number
  aspectRatio: AspectChoice
  resolution: Resolution
  frames: { start: string | null; end: string | null }
  references: string[]
  seed: number | null
}

export type JobStatus =
  'submitting' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'

export const ACTIVE_STATUSES: JobStatus[] = ['submitting', 'pending', 'in_progress']

/** One id a batch route could not act on, with the reason. */
export interface BatchSkip {
  id: string
  reason: 'not_found' | 'active' | 'not_ready'
}

interface GenerationCost {
  currency: 'USD'
  pricePerSec: number
  priceSource: 'live' | 'fallback' | 'mock' | 'unknown'
  estimatedUsd: number
  actualUsd: number | null
  isByok: boolean | null
  billed: boolean | null
}

export interface GenerationRecord {
  id: string
  createdAt: string
  updatedAt: string
  status: JobStatus
  input: GenerationInput
  preset: { id: string; title: string; slug: string }
  inputsSnapshot: Record<
    string,
    Pick<UploadItem, 'kind' | 'originalName' | 'source' | 'target'> & {
      width?: number
      height?: number
      transport?: 'base64' | 'url'
      sentWidth?: number
      sentHeight?: number
      sentBytes?: number
      format?: 'jpeg' | 'png'
      flattened?: '#ffffff' | '#1c1e20'
    }
  >
  submit?: {
    stage: 'grace' | 'uploading' | 'sending'
    notBefore?: string
    progress?: number
  }
  job?: {
    id: string
    generationId?: string
    submittedAt: string
    startedAt?: string
    completedAt?: string
    expiresAt?: number
  }
  download?: { startedAt: string }
  seedUsed: number | null
  favorite: boolean
  cost: GenerationCost
  output?: {
    video: string
    preview?: string
    width?: number
    height?: number
    durationSec?: number
    bytes?: number
  }
  error?: string
}

export interface HistoryFilters {
  q?: string
  model?: string
  favorite?: boolean
  status?: 'all' | 'done' | 'active' | 'failed'
  tab?: GeneratorTab | 'all'
  mode?: 'all' | 'text' | 'frames' | 'references'
  resolution?: Resolution | 'all'
  aspect?: AspectChoice | 'all'
  audio?: 'any' | 'on' | 'off'
}

export interface GenerationListResult {
  items: GenerationRecord[]
  nextCursor: string | null
  activeCount: number
}

export interface CreditsInfo {
  balance: number | null
  keyLimitRemaining: number | null
  keyLimit: number | null
  usageDaily: number | null
  usageMonthly: number | null
  localSpent: number
  source: 'management' | 'key' | 'mock' | 'none'
  fetchedAt: string
  error?: string
}

/** OS dialog support for the current server. */
export interface SystemCapabilities {
  chooseFiles: boolean
  chooseFolder: boolean
  platform: string
}

export type SecretSource = 'env' | 'keychain' | 'file'

export interface SecretKeyStatus {
  set: boolean
  source: SecretSource | null
  hint: string | null
}

/** Stored key status, without values. */
export interface SecretStatus {
  backend: 'keychain' | 'file' | null
  loading: boolean
  loadError: string | null
  keys: Record<SecretName, SecretKeyStatus>
}

/** Server price for one draft, discounted and at list. */
export interface GenerationEstimate {
  estimatedUsd: number
  listUsd: number
  pricePerSec: number
  priceSource: 'live' | 'fallback' | 'mock' | 'unknown'
  discount: number
}

/** Live and list SKU rates for one preset. */
export interface PricingInfo {
  skus: Record<string, number>
  listSkus: Record<string, number>
  discount: number
  source: 'live' | 'fallback' | 'mock'
  fetchedAt: string
}

/** Result of a stored credential test. */
export interface TestResult {
  ok: boolean
  mock?: boolean
  label?: string
  error?: string
}
