import { isNil } from 'lodash-es'

import type { ProviderKindId } from './providers/types'
import type {
  JobStatus,
  RecordDownload,
  RecordProgress,
  RecordSubmit,
} from './schemas/generation-record'

export const STATUS_HELP_KEYS = [
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
] as const

export type StatusHelpKey = (typeof STATUS_HELP_KEYS)[number]

export interface StatusHelp {
  label: string
  what: string
  cancel: string
  charged: string
  quit: string
}

/** Single source for pill labels and tooltips. Tested against the README table. */
export const STATUS_HELP: Record<StatusHelpKey, StatusHelp> = {
  processing: {
    label: 'Processing',
    what: 'Waiting 10 seconds before sending',
    cancel: 'Yes',
    charged: 'No',
    quit: 'Better not. If the app is closed for more than a minute, this video is not sent.',
  },
  uploading: {
    label: 'Uploading',
    what: 'Sending your reference files to R2',
    cancel: 'No',
    charged: 'No',
    quit: 'No. It stops and shows Failed.',
  },
  sending: {
    label: 'Sending',
    what: 'Handing the job to OpenRouter',
    cancel: 'No',
    charged: 'Maybe',
    quit: "If you quit, the app finishes sending first (up to a minute). If the computer crashes here, check OpenRouter's activity page before trying again.",
  },
  pending: {
    label: 'Processing',
    what: 'OpenRouter accepted it and is starting the model',
    cancel: 'No',
    charged: 'When it finishes',
    quit: 'Yes, briefly. Reopen within a few hours.',
  },
  generating: {
    label: 'Generating',
    what: 'The model is making your video',
    cancel: 'No',
    charged: 'When it finishes',
    quit: 'Yes, briefly. Reopen within a few hours.',
  },
  downloading: {
    label: 'Downloading',
    what: 'Saving the finished video to your computer',
    cancel: 'No',
    charged: 'Yes',
    quit: 'No. Wait a moment.',
  },
  completed: {
    label: 'Completed',
    what: 'Saved on your computer',
    cancel: 'No',
    charged: 'Yes',
    quit: 'Yes',
  },
  failed: {
    label: 'Failed',
    what: 'Something went wrong. The card says what.',
    cancel: 'No',
    charged: 'Usually not',
    quit: 'Yes',
  },
  expired: {
    label: 'Expired',
    what: 'The model took too long, or the finished video was gone before the app could download it',
    cancel: 'No',
    charged: 'Possibly, if it finished',
    quit: 'Yes',
  },
  cancelled: {
    label: 'Cancelled',
    what: 'You cancelled it, or it was never sent',
    cancel: 'No',
    charged: 'No',
    quit: 'Yes',
  },
  waiting_comfyui: {
    label: 'Waiting for ComfyUI',
    what: 'ComfyUI is busy with another job',
    cancel: 'Yes, with Stop in ComfyUI',
    charged: 'When it finishes',
    quit: 'ComfyUI keeps running this job. The app picks it up on the next start.',
  },
  queued_n: {
    label: 'In queue, N ahead',
    what: 'Waiting in the ComfyUI queue',
    cancel: 'Yes, with Stop in ComfyUI',
    charged: 'When it finishes',
    quit: 'ComfyUI keeps running this job. The app picks it up on the next start.',
  },
  endpoint_unreachable: {
    label: 'ComfyUI offline, will resume',
    what: 'ComfyUI is not reachable',
    cancel: 'No',
    charged: 'When it finishes',
    quit: 'Quit is safe. The app checks again on the next start.',
  },
}

/** ComfyUI wording for the shared submit stages. Labels stay unchanged. */
const CUSTOM_HELP_OVERRIDES: Partial<Record<StatusHelpKey, Partial<StatusHelp>>> = {
  uploading: {
    what: 'Sending your reference files to ComfyUI',
  },
  sending: {
    what: 'Handing the job to ComfyUI',
  },
  pending: {
    what: 'ComfyUI accepted it and is starting the workflow',
  },
}

export interface StatusHelpParams {
  key: StatusHelpKey
  provider: ProviderKindId
}

/** Status help with the provider wording applied. */
export function statusHelpFor(params: StatusHelpParams): StatusHelp {
  const { key, provider } = params
  const help = STATUS_HELP[key]

  if (provider !== 'custom') {
    return help
  }

  const overrides = CUSTOM_HELP_OVERRIDES[key]

  if (isNil(overrides)) {
    return help
  }

  return { ...help, ...overrides }
}

/** Image wording for the shared status help. */
const IMAGE_HELP_OVERRIDES: Partial<Record<StatusHelpKey, Partial<StatusHelp>>> = {
  processing: {
    quit: 'Better not. If the app is closed for more than a minute, this image is not sent.',
  },
  uploading: {
    what: 'Sending your reference files',
  },
  generating: {
    what: 'The model is making your image',
  },
  downloading: {
    what: 'Saving the image to your computer',
  },
  expired: {
    what: 'The model took too long, or the finished image was gone before the app could save it',
  },
}

/** One status help entry with image wording. */
export function imageStatusHelp(
  key: StatusHelpKey,
  provider: ProviderKindId = 'openrouter',
): StatusHelp {
  const help = statusHelpFor({ key, provider })
  const isCustomUploading = key === 'uploading' && provider === 'custom'

  if (isCustomUploading) {
    return help
  }

  const overrides = IMAGE_HELP_OVERRIDES[key]

  if (isNil(overrides)) {
    return help
  }

  return { ...help, ...overrides }
}

const STATUS_KEYS: Record<JobStatus, StatusHelpKey> = {
  submitting: 'processing',
  pending: 'pending',
  in_progress: 'generating',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'expired',
}

interface StatusHelpRecord {
  status: JobStatus
  submit?: RecordSubmit
  download?: RecordDownload
  progress?: RecordProgress
  error?: string
}

/** Waiting keys for a custom job that has not started on the model yet. */
function waitingKey(record: StatusHelpRecord): StatusHelpKey | null {
  const waitingOn = record.progress?.waitingOn

  if (waitingOn === 'comfyui_busy') {
    return 'waiting_comfyui'
  }

  if (waitingOn === 'pack_queue') {
    return 'queued_n'
  }

  return null
}

function activeKey(record: StatusHelpRecord, status: JobStatus): StatusHelpKey {
  const waiting = waitingKey(record)

  if (!isNil(waiting)) {
    return waiting
  }

  if (record.error?.includes('comfy_unavailable') === true) {
    return 'endpoint_unreachable'
  }

  return STATUS_KEYS[status]
}

/** Current visual state, including submit stages, waiting states and the download. */
export function statusHelpKey(record: StatusHelpRecord): StatusHelpKey {
  if (record.download) {
    return 'downloading'
  }

  if (record.status === 'submitting') {
    const stage = record.submit?.stage

    if (stage === 'uploading' || stage === 'sending') {
      return stage
    }

    return 'processing'
  }

  if (record.status === 'pending' || record.status === 'in_progress') {
    return activeKey(record, record.status)
  }

  return STATUS_KEYS[record.status]
}

/** Tooltip text: what is happening plus cancel, charge and quit safety. */
export function statusHelpText(help: StatusHelp): string {
  return `${help.what}. Cancel: ${help.cancel}. Charged: ${help.charged}. OK to quit: ${help.quit}`
}
