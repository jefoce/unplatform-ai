import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemAdapter } from '@/server/system/types'

const adapter = vi.hoisted(() => {
  return {
    canChooseFiles: vi.fn(async () => {
      return true
    }),
    chooseFiles: vi.fn(async () => {
      return ['/adapter/picked.png']
    }),
    chooseFolder: vi.fn(async () => {
      return null
    }),
    reveal: vi.fn(async () => {}),
  }
})

vi.mock('@/server/system/darwin', () => {
  return { darwin: adapter }
})

vi.mock('@/server/system/linux', () => {
  return { linux: adapter }
})

vi.mock('@/server/system/win32', () => {
  return { win32: adapter }
})

const ROOT = path.join(process.cwd(), '.cache', `system-choose-files-${process.pid}`)
const CHOOSE_FILE = path.join(ROOT, 'e2e-choose.txt')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const PREVIOUS_E2E = process.env.E2E

const OPTS: Parameters<SystemAdapter['chooseFiles']>[0] = {
  kinds: ['image'],
  multiple: true,
  prompt: 'Choose media files',
}

process.env.STORAGE_ROOT = ROOT

let getSystem: () => SystemAdapter

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(ROOT, { recursive: true })
  getSystem = (await import('@/server/system')).getSystem
})

beforeEach(async () => {
  delete process.env.E2E
  await fs.rm(CHOOSE_FILE, { force: true })
  adapter.chooseFiles.mockClear()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }

  if (isNil(PREVIOUS_E2E)) {
    delete process.env.E2E
  } else {
    process.env.E2E = PREVIOUS_E2E
  }
})

describe('getSystem choose files', () => {
  it('returns one path per non-blank line in E2E mode', async () => {
    const first = path.join(ROOT, 'first.png')
    const second = path.join(ROOT, 'second.png')

    await fs.writeFile(CHOOSE_FILE, `\n ${first} \n\n${second}\n`)
    process.env.E2E = '1'

    await expect(getSystem().chooseFiles(OPTS)).resolves.toEqual([first, second])
    expect(adapter.chooseFiles).not.toHaveBeenCalled()
  })

  it('ignores the stub file outside E2E and uses the adapter', async () => {
    await fs.writeFile(CHOOSE_FILE, `${path.join(ROOT, 'ignored.png')}\n`)

    await expect(getSystem().chooseFiles(OPTS)).resolves.toEqual(['/adapter/picked.png'])
    expect(adapter.chooseFiles).toHaveBeenCalledTimes(1)
  })
})
