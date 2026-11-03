import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it, vi } from 'vitest'

import { MAX_IDS } from '../src/core/constants'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-uploads-bounds-'))

process.env.STORAGE_ROOT = root

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const { GET } = await import('@/app/api/uploads/route')

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('GET /api/uploads', () => {
  it('rejects more than MAX_IDS ids', async () => {
    const ids = Array.from({ length: MAX_IDS + 1 }, (_, index) => {
      return `id-${String(index)}`
    }).join(',')

    const response = await GET(
      new Request(`http://127.0.0.1:3000/api/uploads?ids=${ids}`, {
        headers: { host: '127.0.0.1:3000' },
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: `Too many ids (max ${MAX_IDS})` })
  })
})
