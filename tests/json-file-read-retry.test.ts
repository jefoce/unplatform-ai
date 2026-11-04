import fs from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { readJson } from '@/server/fs/json-file'

const ItemSchema = z.object({ id: z.string() })

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

function missing(): NodeJS.ErrnoException {
  return Object.assign(new Error('missing'), { code: 'ENOENT' })
}

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()

  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
})

describe('readJson retry', () => {
  it('retries a reader once on ENOENT mid-save', async () => {
    const readFile = vi
      .spyOn(fs, 'readFile')
      .mockRejectedValueOnce(missing())
      .mockResolvedValueOnce(JSON.stringify({ id: 'x' }))

    await expect(readJson('/data/x.json', ItemSchema)).resolves.toEqual({ id: 'x' })

    expect(readFile).toHaveBeenCalledTimes(2)
  })

  it('returns null when the file is still absent after the retry', async () => {
    const readFile = vi.spyOn(fs, 'readFile').mockRejectedValue(missing())

    await expect(readJson('/data/x.json', ItemSchema)).resolves.toBeNull()

    expect(readFile).toHaveBeenCalledTimes(2)
  })
})
