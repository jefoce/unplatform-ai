import 'server-only'

import { randomInt, randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import {
  MAX_ACTIVE_JOBS,
  MAX_REQUEST_MB,
  REQUEST_RESERVE_MB,
  SEED_MAX,
  SUBMIT_GRACE_MS,
} from '@/core/constants'
import type { ReferencePlan } from '@/core/media/media-types'
import { activeBinding } from '@/core/presets/common/bindings'
import type {
  GenerationCost,
  GenerationInput,
  GenerationRecord,
  InputSnapshot,
} from '@/core/schemas/generation-record'

import { HttpError } from '../errors'
import { startSubmit } from '../jobs/submit-queue'
import { encodeImages } from '../media/image-data-url'
import { getVideoProvider } from '../providers/registry'
import { getActiveCount, saveGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { estimateGeneration, loadDraft } from './estimate-generation'
import { snapshotItem } from './upload-snapshot'

/** Validates, writes a grace record, then queues upload and submit in the background. */
export async function createGeneration(raw: GenerationInput): Promise<GenerationRecord> {
  const { preset, input, uploads } = await loadDraft(raw)

  const estimate = await estimateGeneration({ preset, input, uploads })
  const { estimatedUsd, pricePerSec } = estimate

  if (estimate.priceSource === 'unknown' || isNil(estimatedUsd) || isNil(pricePerSec)) {
    throw new HttpError(409, 'Price unavailable for this model')
  }

  const encoded = await encodeImages({
    uploads: Object.values(uploads),
    preset,
    budgetBytes: MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024,
  })

  const now = new Date().toISOString()

  const binding = activeBinding(preset, (item) => {
    return getVideoProvider(item.provider).isConfigured()
  })

  const cost: GenerationCost = {
    currency: 'USD',
    pricePerSec,
    priceSource: estimate.priceSource,
    estimatedUsd,
    actualUsd: null,
    referenceSeconds: estimate.referenceSeconds,
    isByok: null,
    billed: null,
  }

  const record: GenerationRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: binding.provider,
    input: { ...input, frames: { ...input.frames }, references: [...input.references] },
    preset: { id: preset.id, title: preset.title, slug: binding.modelId },
    inputsSnapshot: snapshot(uploads, encoded.plan),
    submit: {
      stage: 'grace',
      notBefore: new Date(Date.now() + SUBMIT_GRACE_MS).toISOString(),
    },
    seedUsed: input.seed ?? randomInt(0, SEED_MAX),
    favorite: false,
    cost,
  }

  const saved = await withLock('active-generations', async () => {
    if ((await getActiveCount()) >= MAX_ACTIVE_JOBS) {
      throw new HttpError(
        429,
        `${MAX_ACTIVE_JOBS} videos already generating. Wait for one to finish.`,
      )
    }

    return saveGeneration(record)
  })

  await startSubmit(saved.id)

  return saved
}

function snapshot(uploads: UploadsById, plan: ReferencePlan): InputSnapshot {
  const sent = new Map(
    plan.images.map((image) => {
      return [image.id, image]
    }),
  )

  return Object.fromEntries(
    Object.values(uploads).map((upload) => {
      const image = sent.get(upload.id)
      const item = snapshotItem(upload)

      if (image) {
        item.sentWidth = image.width
        item.sentHeight = image.height
        item.sentBytes = image.bytes
        item.format = image.format
        item.flattened = image.flattened
      }

      return [upload.id, item] as const
    }),
  )
}
