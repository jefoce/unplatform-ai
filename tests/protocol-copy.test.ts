import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { required } from './helpers/required'

const VENDORED_ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const PACK_ROOT = '/Users/jefoce/Documents/AI/unplatform-ai-provider-node'
const PACK_PROTOCOL = path.join(PACK_ROOT, 'protocol')
const PACK_REF = path.join(PACK_ROOT, '.git/refs/heads/0.1.0')
const SOURCE = fs.readFileSync(path.join(VENDORED_ROOT, 'SOURCE'), 'utf8')
const COMMIT = required(/^commit:\s*(\S+)$/m.exec(SOURCE)?.[1], 'commit in SOURCE')
const HAS_PACK = fs.existsSync(PACK_PROTOCOL)

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

/** Bytes of a file in the pack working tree. */
function packFile(name: string): Buffer {
  return fs.readFileSync(path.join(PACK_PROTOCOL, name))
}

function packFiles(): string[] {
  return filesUnder(PACK_PROTOCOL)
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

  it('pins the pack branch and commit', () => {
    const ref = fs.readFileSync(PACK_REF, 'utf8').trim()

    expect(path.basename(PACK_REF)).toBe('0.1.0')
    expect(ref.startsWith(COMMIT)).toBe(true)
  })
})
