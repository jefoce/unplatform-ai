import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { acquire, assertFree, LOCK_PATH, release } from '../scripts/build-lock.mjs'
import { assertStandaloneBuild, compareStagedServer } from '../scripts/prepare-desktop.mjs'

const roots: string[] = []

const tempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'desktop-build-'))

  roots.push(dir)

  return dir
}

/**
 * Writes `relative` under `root` and creates the parent directories.
 */
async function writeFile(root: string, relative: string, text: string) {
  const file = path.join(root, relative)

  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, text)
}

/**
 * Message of the rejection, so one assertion can look at the whole failure.
 */
async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  return ''
}

afterEach(async () => {
  delete process.env.UNPLATFORM_DESKTOP_BUILD

  for (const root of roots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true })
  }
})

describe('assertStandaloneBuild', () => {
  it('fails when .next/standalone/server.js is missing', async () => {
    const nextDir = await tempDir()

    await writeFile(nextDir, 'BUILD_ID', 'build-id')
    await writeFile(nextDir, 'standalone/.next/BUILD_ID', 'build-id')

    const message = await messageOf(assertStandaloneBuild(nextDir))

    expect(message).toContain(path.join('standalone', 'server.js'))
  })

  it('fails when the standalone BUILD_ID is missing', async () => {
    const nextDir = await tempDir()

    await writeFile(nextDir, 'BUILD_ID', 'build-id')
    await writeFile(nextDir, 'standalone/server.js', 'server')

    const message = await messageOf(assertStandaloneBuild(nextDir))

    expect(message).toContain(path.join('standalone', '.next', 'BUILD_ID'))
  })

  it('fails when the standalone BUILD_ID differs from .next/BUILD_ID', async () => {
    const nextDir = await tempDir()

    await writeFile(nextDir, 'BUILD_ID', 'fresh-id')
    await writeFile(nextDir, 'standalone/server.js', 'server')
    await writeFile(nextDir, 'standalone/.next/BUILD_ID', 'stale-id')

    const message = await messageOf(assertStandaloneBuild(nextDir))

    expect(message).toContain('fresh-id')
    expect(message).toContain('stale-id')
  })

  it('accepts a complete standalone output with one BUILD_ID', async () => {
    const nextDir = await tempDir()

    await writeFile(nextDir, 'BUILD_ID', 'same-id')
    await writeFile(nextDir, 'standalone/server.js', 'server')
    await writeFile(nextDir, 'standalone/.next/BUILD_ID', 'same-id')

    await expect(assertStandaloneBuild(nextDir)).resolves.toBeUndefined()
  })
})

describe('compareStagedServer', () => {
  it('lists every missing and extra staged file', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const staged = path.join(root, 'staged')

    await writeFile(source, 'app/api/health/route.js', 'route')
    await writeFile(source, 'chunks/present.js', 'present')
    await writeFile(source, 'chunks/missing.js', 'missing')

    await writeFile(staged, 'app/api/health/route.js', 'route')
    await writeFile(staged, 'chunks/present.js', 'present')
    await writeFile(staged, 'chunks/extra.js', 'extra')

    const message = await messageOf(compareStagedServer(source, staged))

    expect(message).toContain('chunks/missing.js')
    expect(message).toContain('chunks/extra.js')
  })

  it('accepts a staged copy that matches the standalone output', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const staged = path.join(root, 'staged')

    await writeFile(source, 'chunks/a.js', 'a')
    await writeFile(staged, 'chunks/a.js', 'a')

    await expect(compareStagedServer(source, staged)).resolves.toBeUndefined()
  })
})

describe('build lock', () => {
  it('keeps the lock in the repo root', () => {
    expect(LOCK_PATH).toBe(path.resolve('.desktop-build.lock'))
  })

  it('throws while a live process holds the lock', async () => {
    const file = path.join(await tempDir(), '.desktop-build.lock')

    acquire(file)

    expect(() => {
      assertFree(file)
    }).toThrow(/Desktop build in progress/)

    release(file)
  })

  it('removes a lock whose pid is dead', async () => {
    const file = path.join(await tempDir(), '.desktop-build.lock')
    const { pid } = spawnSync(process.execPath, ['-e', ''])

    if (pid === undefined) {
      throw new Error('spawnSync did not report a pid')
    }

    await writeFile(
      path.dirname(file),
      path.basename(file),
      JSON.stringify({ pid, startedAt: new Date().toISOString() }),
    )

    expect(() => {
      assertFree(file)
    }).not.toThrow()

    await expect(fs.access(file)).rejects.toThrow()
  })

  it('skips the check inside the desktop build', async () => {
    const file = path.join(await tempDir(), '.desktop-build.lock')

    acquire(file)
    process.env.UNPLATFORM_DESKTOP_BUILD = '1'

    expect(() => {
      assertFree(file)
    }).not.toThrow()

    release(file)
  })
})
