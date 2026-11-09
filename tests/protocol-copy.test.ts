import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { required } from './helpers/required'

const VENDORED_ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const PACK_ROOT = '/Users/jefoce/Documents/AI/unplatform-ai-provider-node'
const PACK_PROTOCOL = 'protocol/'
const SOURCE = fs.readFileSync(path.join(VENDORED_ROOT, 'SOURCE'), 'utf8')
const COMMIT = required(/^commit:\s*(\S+)$/m.exec(SOURCE)?.[1], 'commit in SOURCE')
const HAS_PACK = fs.existsSync(PACK_ROOT)

/** Files under a directory, relative and slash separated. */
function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => {
      return fs.statSync(path.join(dir, entry)).isFile()
    })
    .map((entry) => {
      return entry.split(path.sep).join('/')
    })
}

/** Bytes of a file in the pack at the pinned commit. */
function packFile(name: string): Buffer {
  return execFileSync('git', ['-C', PACK_ROOT, 'show', `${COMMIT}:${PACK_PROTOCOL}${name}`])
}

function packFiles(): string[] {
  const listed = execFileSync(
    'git',
    ['-C', PACK_ROOT, 'ls-tree', '-r', '--name-only', COMMIT, PACK_PROTOCOL],
    { encoding: 'utf8' },
  )

  return listed
    .trim()
    .split('\n')
    .map((name) => {
      return name.slice(PACK_PROTOCOL.length)
    })
}

describe.skipIf(!HAS_PACK)('vendored upai/1 tree', () => {
  it('matches the pack file list', () => {
    const vendored = filesUnder(VENDORED_ROOT).filter((name) => {
      return name !== 'SOURCE'
    })

    expect(vendored.sort()).toEqual(packFiles().sort())
  })

  it('matches every pack file byte for byte', () => {
    for (const name of packFiles()) {
      const vendored = fs.readFileSync(path.join(VENDORED_ROOT, name))

      expect(vendored.equals(packFile(name)), name).toBe(true)
    }
  })
})
