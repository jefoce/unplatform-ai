import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { hashFile } from '@/server/storage/hash'

const DIR = path.join(process.cwd(), '.cache', 'remote-hash-test')
const FILE = path.join(DIR, 'fixture.bin')
const BYTES = Buffer.from('wan-studio remote hash fixture\n')

beforeAll(async () => {
  await fs.mkdir(DIR, { recursive: true })
  await fs.writeFile(FILE, BYTES)
})

afterAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true })
})

describe('hashFile', () => {
  it('returns hex, base64, size and mtime', async () => {
    const expected = createHash('sha256').update(BYTES).digest()
    const stats = await fs.stat(FILE)
    const result = await hashFile(FILE)

    expect(result.sha256Hex).toBe(expected.toString('hex'))
    expect(result.sha256Base64).toBe(expected.toString('base64'))
    expect(result.size).toBe(BYTES.length)
    expect(result.mtimeMs).toBe(stats.mtimeMs)
  })
})
