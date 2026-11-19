import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { bundleChunkRefs, missingBundleChunks } from '../scripts/smoke-server.mjs'

const roots: string[] = []

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-server-'))

  roots.push(dir)

  return dir
}

/**
 * Writes a route that references the given chunk files.
 */
async function writeRoute(root: string, name: string, chunks: string[]): Promise<void> {
  const file = path.join(root, 'server', 'app', name, 'route.js')

  const refs = chunks
    .map((chunk) => {
      return `R.c("server/chunks/${chunk}")`
    })
    .join('\n')

  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `var R = require("../../chunks/[turbopack]_runtime.js")\n${refs}\n`)
}

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true })
  }
})

describe('smoke server preflight', () => {
  it('collects route and instrumentation chunk refs that exist', async () => {
    const root = await tempDir()

    await writeRoute(root, 'health', ['present.js'])

    await fs.writeFile(
      path.join(root, 'server', 'instrumentation.js'),
      'var R = require("./chunks/[turbopack]_runtime.js")\nR.c("server/chunks/boot.js")\n',
    )

    await fs.mkdir(path.join(root, 'server', 'chunks'), { recursive: true })
    await fs.writeFile(path.join(root, 'server', 'chunks', 'present.js'), '')
    await fs.writeFile(path.join(root, 'server', 'chunks', 'boot.js'), '')

    expect(await bundleChunkRefs(root)).toEqual([
      'server/chunks/boot.js',
      'server/chunks/present.js',
    ])

    expect(await missingBundleChunks(root)).toEqual([])
  })

  it('names a chunk that the build does not contain', async () => {
    const root = await tempDir()

    await writeRoute(root, 'health', ['gone.js'])

    expect(await missingBundleChunks(root)).toEqual(['server/chunks/gone.js'])
  })
})
