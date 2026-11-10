import 'server-only'

import { ACTIVE_STATUSES } from '@/core/types'

import { updateGeneration } from '../repos/generations'
import { shortErrorText } from '../services/endpoint-health-report'

const OFFLINE_ERROR_PREFIX = 'upai:comfy_unavailable:'

/** The pill shows only after the endpoint crossed the failure threshold. */
export async function writeTransientOffline(id: string, error: unknown): Promise<void> {
  const text = `${OFFLINE_ERROR_PREFIX} ${shortErrorText(error)}`

  await updateGeneration(id, (latest) => {
    if (!ACTIVE_STATUSES.includes(latest.status) || latest.error === text) {
      return null
    }

    return { ...latest, error: text, errorStatus: undefined }
  })
}
