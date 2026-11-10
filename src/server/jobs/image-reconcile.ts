import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'

import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import type {
  ImageCost,
  ImageOutput,
  ImageOutputMediaType,
  ImageRecord,
} from '@/core/schemas/image-record'
import { isStaleGrace } from '@/core/submit-state'

import sharp, { SHARP_INPUT_OPTIONS, sharpQueue } from '../media/sharp'
import { IMAGES_DIR } from '../paths'
import { getImage, listImages } from '../repos/images'
import { seedForImage } from './image-calls'
import { imageStatusFor } from './image-output-helpers'
import { updateImage } from './image-record'
import { isImageSubmitOwned, resumeImageSubmits } from './image-submit-queue'
import { GRACE_EXPIRED_TEXT } from './reconcile'

const INTERRUPT_TEXT = {
  uploading: 'Interrupted while preparing images',
  saving: 'Interrupted while saving images',
} as const

const SAVE_FAILED_TEXT = 'Could not save the images. The saved files may still be on disk.'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const

type ImageExtension = (typeof IMAGE_EXTENSIONS)[number]

const MEDIA_TYPE_BY_EXTENSION: Record<ImageExtension, ImageOutputMediaType> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function needsInterrupt(record: ImageRecord): boolean {
  const stage = record.submit?.stage
  const isSending = stage === 'uploading' || stage === 'sending'

  return record.status === 'submitting' && isSending && !isImageSubmitOwned(record.id)
}

function interruptText(record: ImageRecord): string {
  if (record.submit?.stage === 'sending') {
    return INTERRUPT_SENDING_TEXT
  }

  return INTERRUPT_TEXT.uploading
}

/** A send cut off by a crash may have reached the provider. */
function interruptCost(record: ImageRecord): ImageCost {
  if (record.submit?.stage !== 'sending') {
    return record.cost
  }

  return { ...record.cost, mayHaveBeenCharged: true }
}

interface RecoverOutputParams {
  record: ImageRecord
  output: ImageOutput
}

/** A pending output whose file survived the crash becomes saved with its planned id. */
async function recoverOutput(params: RecoverOutputParams): Promise<ImageOutput> {
  const { record, output } = params

  for (const extension of IMAGE_EXTENSIONS) {
    const name = `${record.id}-${output.index}${extension}`
    const file = path.join(IMAGES_DIR, name)

    const stats = await fs.stat(file).catch(() => {
      return null
    })

    if (stats?.isFile() !== true) {
      continue
    }

    const meta = await sharpQueue
      .run(() => {
        return sharp(file, SHARP_INPUT_OPTIONS).metadata()
      })
      .catch(() => {
        return null
      })

    if (isNil(meta?.width) || isNil(meta.height)) {
      continue
    }

    return {
      id: output.id,
      index: output.index,
      status: 'saved',
      file: name,
      mediaType: MEDIA_TYPE_BY_EXTENSION[extension],
      width: meta.width,
      height: meta.height,
      bytes: stats.size,
      favorite: false,
      seed: seedForImage(record.seedUsed, output.index),
    }
  }

  return { id: output.id, index: output.index, status: 'failed', error: INTERRUPT_TEXT.saving }
}

async function recoverSaving(record: ImageRecord): Promise<ImageOutput[]> {
  const outputs: ImageOutput[] = []

  for (const output of record.outputs) {
    if (output.status !== 'pending') {
      outputs.push(output)
      continue
    }

    outputs.push(await recoverOutput({ record, output }))
  }

  return outputs
}

interface SaveRecoveredParams {
  record: ImageRecord
  recovered: ImageOutput[]
  isUnownedOnly: boolean
}

async function saveRecovered(params: SaveRecoveredParams): Promise<void> {
  const { record, recovered, isUnownedOnly } = params

  const byId = new Map(
    recovered.map((output) => {
      return [output.id, output]
    }),
  )

  await updateImage(record.id, (current) => {
    if (current.status !== 'saving') {
      return null
    }

    if (isUnownedOnly && isImageSubmitOwned(current.id)) {
      return null
    }

    const outputs = current.outputs.map((output) => {
      return byId.get(output.id) ?? output
    })

    const status = imageStatusFor(outputs)
    const error = status === 'completed' ? undefined : INTERRUPT_TEXT.saving

    return {
      ...current,
      status,
      outputs,
      error,
      errorStatus: undefined,
      submit: undefined,
      cost: { ...current.cost, mayHaveBeenCharged: true },
    }
  })
}

async function reconcileSaving(record: ImageRecord): Promise<void> {
  const recovered = await recoverSaving(record)

  await saveRecovered({ record, recovered, isUnownedOnly: true })
}

function failedOutput(output: ImageOutput): ImageOutput {
  return { id: output.id, index: output.index, status: 'failed', error: SAVE_FAILED_TEXT }
}

interface ForceSavingFailedParams {
  record: ImageRecord
  recovered: ImageOutput[]
}

/** Writes the terminal failure after the retry budget, so the record never stays saving. */
async function forceSavingFailed(params: ForceSavingFailedParams): Promise<void> {
  const { record, recovered } = params

  await updateImage(record.id, (current) => {
    if (current.status !== 'saving') {
      return null
    }

    const outputs = current.outputs.map((output) => {
      const recoveredOutput = recovered.find((item) => {
        return item.id === output.id
      })

      return recoveredOutput ?? failedOutput(output)
    })

    return {
      ...current,
      status: 'failed',
      outputs,
      error: SAVE_FAILED_TEXT,
      errorStatus: undefined,
      submit: undefined,
      cost: { ...current.cost, mayHaveBeenCharged: true },
    }
  })
}

/** Recovers a save that failed after the record reached saving, retrying the write once. */
export async function recoverFailedSaving(id: string): Promise<void> {
  const record = await getImage(id)

  if (record?.status !== 'saving') {
    return
  }

  const recovered = await recoverSaving(record)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await saveRecovered({ record, recovered, isUnownedOnly: false })

      return
    } catch (error) {
      if (attempt === 1) {
        console.error(`[unplatform-ai] image save recovery failed for ${id}`, error)
      }
    }
  }

  try {
    await forceSavingFailed({ record, recovered })
  } catch (error) {
    console.error(`[unplatform-ai] image save failure could not be persisted for ${id}`, error)
  }
}

function isMaybeCharged(record: ImageRecord): boolean {
  return record.status === 'saving' || record.submit?.stage === 'sending'
}

/** Shutdown gave up on an in-flight send, so the next boot must warn about the charge. */
export async function flagUnfinishedImageCharges(): Promise<void> {
  for (const record of await listImages()) {
    if (!isMaybeCharged(record) || record.cost.mayHaveBeenCharged === true) {
      continue
    }

    await updateImage(record.id, (current) => {
      if (!isMaybeCharged(current)) {
        return null
      }

      return { ...current, cost: { ...current.cost, mayHaveBeenCharged: true } }
    })
  }
}

/** Cancels stale grace records, resumes fresh ones, recovers or fails orphaned image saves. */
export async function reconcileImages(): Promise<void> {
  for (const record of await listImages()) {
    if (!isStaleGrace(record)) {
      continue
    }

    await updateImage(record.id, (current) => {
      if (!isStaleGrace(current)) {
        return null
      }

      return {
        ...current,
        status: 'cancelled',
        error: GRACE_EXPIRED_TEXT,
        submit: undefined,
      }
    })
  }

  await resumeImageSubmits()

  for (const record of await listImages()) {
    if (record.status === 'saving') {
      if (!isImageSubmitOwned(record.id)) {
        await reconcileSaving(record)
      }

      continue
    }

    if (!needsInterrupt(record)) {
      continue
    }

    await updateImage(record.id, (current) => {
      if (!needsInterrupt(current)) {
        return null
      }

      return {
        ...current,
        status: 'failed',
        error: interruptText(current),
        submit: undefined,
        cost: interruptCost(current),
      }
    })
  }
}
