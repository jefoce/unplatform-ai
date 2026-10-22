import 'server-only'

import { randomInt, randomUUID } from 'node:crypto'

import { MAX_REQUEST_MB, REQUEST_RESERVE_MB, SEED_MAX, SUBMIT_GRACE_MS } from '@/core/constants'
import type { GenerationInput, GenerationRecord, ReferencePlan, UploadItem } from '@/core/types'

import { encodeImages } from '../media/image-data-url'
import { saveGeneration } from '../repos/generations'
import { estimateGeneration, loadDraft } from './estimate-generation'
import { startSubmit } from './submit-queue'

/** Validates, writes a grace record, then queues upload and submit in the background. */
export async function createGeneration(raw: GenerationInput): Promise<GenerationRecord> {
  const { preset, input, uploads } = await loadDraft(raw)
  const encoded = await encodeImages({
    uploads: Object.values(uploads),
    preset,
    budgetBytes: MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024,
  })
  const estimate = await estimateGeneration({ preset, input, uploads })
  const now = new Date().toISOString()

  const record: GenerationRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    input: { ...input, frames: { ...input.frames }, references: [...input.references] },
    preset: { id: preset.id, title: preset.title, slug: preset.slug },
    inputsSnapshot: snapshot(uploads, encoded.plan),
    submit: {
      stage: 'grace',
      notBefore: new Date(Date.now() + SUBMIT_GRACE_MS).toISOString(),
    },
    seedUsed: input.seed ?? randomInt(0, SEED_MAX),
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: estimate.pricePerSec,
      priceSource: estimate.priceSource,
      estimatedUsd: estimate.estimatedUsd,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
  const saved = await saveGeneration(record)

  await startSubmit(saved.id)

  return saved
}

function snapshot(
  uploads: Record<string, UploadItem>,
  plan: ReferencePlan,
): GenerationRecord['inputsSnapshot'] {
  const sent = new Map(plan.images.map((image) => [image.id, image]))

  return Object.fromEntries(
    Object.values(uploads).map((upload) => {
      const image = sent.get(upload.id)
      const item: GenerationRecord['inputsSnapshot'][string] = {
        kind: upload.kind,
        originalName: upload.originalName,
        source: upload.source,
        target: upload.target,
        width: upload.width,
        height: upload.height,
      }

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
