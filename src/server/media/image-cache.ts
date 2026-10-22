import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { FLATTEN_BACKGROUND, FLATTEN_LIGHT } from '@/core/constants'

import { readJson, writeJsonAtomic } from '../fs/json-file'
import { UPLOADS_DIR } from '../paths'

/** Flatten color used for transparent images sent to models without alpha. */
export type FlattenColor = typeof FLATTEN_BACKGROUND | typeof FLATTEN_LIGHT

export interface EncodedImage {
  url: string
  bytes: number
  width: number
  height: number
  format: 'jpeg' | 'png'
  flattened?: FlattenColor
}

const CacheSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.enum(['jpeg', 'png']),
  flattened: z.enum([FLATTEN_BACKGROUND, FLATTEN_LIGHT]).optional(),
})

export type CacheRecord = z.infer<typeof CacheSchema>

const cacheStem = (id: string, step: number): string =>
  path.join(UPLOADS_DIR, `${id}.encoded-${step}`)

const opaqueFile = (id: string): string => path.join(UPLOADS_DIR, `${id}.opaque.json`)

const OpaqueSchema = z.boolean()

/** Per upload, so every ladder step and the submit share one stats() result. */
export async function readOpaque(id: string): Promise<boolean | null> {
  const parsed = OpaqueSchema.safeParse(await readJson<unknown>(opaqueFile(id)))

  return parsed.success ? parsed.data : null
}

export async function writeOpaque(id: string, isOpaque: boolean): Promise<void> {
  await writeJsonAtomic({ file: opaqueFile(id), data: isOpaque })
}

interface CacheFileParams {
  id: string
  step: number
  format: CacheRecord['format']
}

const cacheFile = (params: CacheFileParams): string => {
  const { id, step, format } = params

  return `${cacheStem(id, step)}.${format === 'jpeg' ? 'jpg' : 'png'}`
}

export function toEncoded(record: CacheRecord, data: Buffer): EncodedImage {
  const mime = record.format === 'jpeg' ? 'image/jpeg' : 'image/png'

  return {
    url: `data:${mime};base64,${data.toString('base64')}`,
    bytes: record.bytes,
    width: record.width,
    height: record.height,
    format: record.format,
    flattened: record.flattened,
  }
}

export async function readCache(id: string, step: number): Promise<EncodedImage | null> {
  const raw = await readJson<unknown>(`${cacheStem(id, step)}.json`)
  const parsed = CacheSchema.safeParse(raw)

  if (!parsed.success) return null

  const file = cacheFile({ id, step, format: parsed.data.format })
  const data = await fs.readFile(file).catch(() => null)

  if (!data) return null

  return toEncoded(parsed.data, data)
}

interface WriteCacheParams {
  id: string
  step: number
  record: CacheRecord
  data: Buffer
}

export async function writeCache(params: WriteCacheParams): Promise<void> {
  const { id, step, record, data } = params
  const stem = cacheStem(id, step)
  const file = cacheFile({ id, step, format: record.format })
  const temp = `${file}.tmp-${randomUUID()}`

  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.writeFile(temp, data)
  await fs.rename(temp, file)
  await writeJsonAtomic({ file: `${stem}.json`, data: record })
}

/** Removes every cached step for an upload. */
export async function removeEncoded(id: string): Promise<void> {
  const prefix = `${id}.encoded-`
  const opaque = `${id}.opaque.json`
  const names = await fs.readdir(UPLOADS_DIR).catch(() => [])

  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix) || name === opaque)
      .map((name) => fs.unlink(path.join(UPLOADS_DIR, name)).catch(() => {})),
  )
}
