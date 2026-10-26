import type { JobStatus, RecordDownload, RecordSubmit } from './schemas/generation-record'

export const STATUS_HELP_KEYS = [
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
  in_queue: {
    label: 'In queue',
    what: 'OpenRouter accepted it and is waiting for the model',
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
}

const STATUS_KEYS: Record<JobStatus, StatusHelpKey> = {
  submitting: 'processing',
  pending: 'in_queue',
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
}

/** Current visual state, including submit stages and the download phase. */
export function statusHelpKey(record: StatusHelpRecord): StatusHelpKey {
  if (record.download) {
    return 'downloading'
  }

  if (record.status !== 'submitting') {
    return STATUS_KEYS[record.status]
  }

  const stage = record.submit?.stage

  if (stage === 'uploading' || stage === 'sending') {
    return stage
  }

  return 'processing'
}

/** Tooltip text: what is happening plus cancel, charge and quit safety. */
export function statusHelpText(help: StatusHelp): string {
  return `${help.what}. Cancel: ${help.cancel}. Charged: ${help.charged}. OK to quit: ${help.quit}`
}
