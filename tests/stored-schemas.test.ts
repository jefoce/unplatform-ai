import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { isRecord } from '@/core/guards'
import { FoldersFileSchema } from '@/core/schemas/folder-item'
import { GenerationRecordSchema } from '@/core/schemas/generation-record'
import { UploadItemSchema } from '@/core/schemas/upload-item'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures')

const STATUSES = [
  'submitting',
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const

async function loadJson(relative: string): Promise<unknown> {
  const text = await fs.readFile(path.join(FIXTURES, relative), 'utf8')

  return JSON.parse(text)
}

describe('stored schemas', () => {
  it.each(STATUSES)('parses a %s record', async (status) => {
    const parsed = GenerationRecordSchema.safeParse(await loadJson(`records/${status}.json`))

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe(status)
    }
  })

  it('defaults the provider for files written before it existed', async () => {
    const parsed = GenerationRecordSchema.safeParse(await loadJson('records/submitting.json'))

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.provider).toBe('openrouter')
    }
  })

  it('parses an upload item', async () => {
    expect(UploadItemSchema.safeParse(await loadJson('uploads/item.json')).success).toBe(true)
  })

  it('parses the folders file', async () => {
    expect(FoldersFileSchema.safeParse(await loadJson('folders/folders.json')).success).toBe(true)
  })

  it('rejects a record with an unknown status', async () => {
    const raw = await loadJson('records/completed.json')

    if (!isRecord(raw)) {
      throw new Error('completed fixture must be an object')
    }

    const parsed = GenerationRecordSchema.safeParse({ ...raw, status: 'paused' })

    expect(parsed.success).toBe(false)

    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['status'])
    }
  })
})
