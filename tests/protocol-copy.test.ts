import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { isEmpty } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { required } from './helpers/required'

const VENDORED_ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const PACK_ROOT = '/Users/jefoce/Documents/AI/unplatform-ai-provider-node'
const SOURCE = fs.readFileSync(path.join(VENDORED_ROOT, 'SOURCE'), 'utf8')
const COMMIT = required(/^commit:\s*(\S+)$/m.exec(SOURCE)?.[1], 'commit in SOURCE')

interface PackSnapshot {
  files: string[]
  error: string
}

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

function git(args: string[]): string {
  return execFileSync('git', ['-C', PACK_ROOT, ...args], { encoding: 'utf8' })
}

/** Files under `protocol/` at the pinned commit, relative to `protocol/`. */
function pinnedFiles(): string[] {
  return git(['ls-tree', '-r', '--name-only', COMMIT, 'protocol/'])
    .split('\n')
    .filter((line) => {
      return line.length > 0
    })
    .map((line) => {
      return line.replace(/^protocol\//, '')
    })
}

/** Bytes of a pinned file, read from git rather than the working tree. */
function pinnedBytes(rel: string): Buffer {
  return execFileSync('git', ['-C', PACK_ROOT, 'show', `${COMMIT}:protocol/${rel}`], {
    maxBuffer: 10 * 1024 * 1024,
  })
}

function readPack(): PackSnapshot {
  if (!fs.existsSync(PACK_ROOT)) {
    return { files: [], error: `pack not found at ${PACK_ROOT}` }
  }

  try {
    return { files: pinnedFiles(), error: '' }
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)

    return { files: [], error: `git cannot read ${COMMIT}: ${detail}` }
  }
}

const PACK = readPack()
const IS_SKIPPED = !isEmpty(PACK.error)
const SUITE = IS_SKIPPED ? `vendored upai/1 tree (skipped: ${PACK.error})` : 'vendored upai/1 tree'

describe.skipIf(IS_SKIPPED)(SUITE, () => {
  it('matches the pinned pack file list', () => {
    const vendored = filesUnder(VENDORED_ROOT).filter((name) => {
      return name !== 'SOURCE'
    })

    expect(vendored.sort()).toEqual([...PACK.files].sort())
  })

  it('matches every pinned pack file byte for byte', () => {
    for (const rel of PACK.files) {
      const vendored = fs.readFileSync(path.join(VENDORED_ROOT, rel))

      expect(vendored.equals(pinnedBytes(rel)), rel).toBe(true)
    }
  })
})
