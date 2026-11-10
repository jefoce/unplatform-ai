import 'server-only'

import path from 'node:path'

import { isString } from 'lodash-es'
import { z } from 'zod'

import { CLEANUP_QUEUE_FILE } from '../paths'
import { withLock } from '../sync/lock'
import { isFileBusy } from './atomic-file'
import { readJson, removeFile, removeOwnedFile, writeJsonAtomic } from './json-file'

const CleanupQueueSchema = z
  .object({
    paths: z.array(z.string()).default([]),
  })
  .loose()

const QUEUE_LOCK = 'cleanup-queue'

function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code

  if (isString(code)) {
    return code
  }

  return 'unknown'
}

function warnLeft(file: string, error: unknown): void {
  console.warn(
    `[unplatform-ai] delete left ${path.basename(file)} for startup cleanup (${errorCode(error)})`,
  )
}

function warnDropped(file: string, error: unknown): void {
  console.warn(`[unplatform-ai] cleanup dropped ${path.basename(file)}: ${errorCode(error)}`)
}

async function readQueue(): Promise<string[]> {
  const value = await readJson(CLEANUP_QUEUE_FILE, CleanupQueueSchema)

  return value?.paths ?? []
}

async function writeQueue(files: string[]): Promise<void> {
  if (files.length === 0) {
    await removeFile(CLEANUP_QUEUE_FILE)

    return
  }

  await writeJsonAtomic({ file: CLEANUP_QUEUE_FILE, data: { paths: files } })
}

async function enqueue(file: string): Promise<void> {
  await withLock(QUEUE_LOCK, async () => {
    const files = await readQueue()

    if (files.includes(file)) {
      return
    }

    await writeQueue([...files, file])
  })
}

/** Deletes an owned file now, or queues it when Windows still holds it open. */
export async function removeOwnedOrQueue(file: string): Promise<boolean> {
  try {
    await removeOwnedFile(file)

    return true
  } catch (error) {
    if (!isFileBusy(error)) {
      throw error
    }

    await enqueue(path.resolve(file))
    warnLeft(file, error)

    return false
  }
}

/** Retries queued deletes at startup. Busy files stay queued, invalid entries are dropped. */
export async function flushCleanupQueue(): Promise<void> {
  await withLock(QUEUE_LOCK, async () => {
    const files = await readQueue()

    if (files.length === 0) {
      return
    }

    const remaining: string[] = []

    for (const file of files) {
      try {
        await removeOwnedFile(file)
      } catch (error) {
        if (isFileBusy(error)) {
          remaining.push(file)

          continue
        }

        warnDropped(file, error)
      }
    }

    await writeQueue(remaining)
  })
}
