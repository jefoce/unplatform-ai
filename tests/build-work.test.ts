import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const isWindows = process.platform === 'win32'

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-work-'))

  roots.push(dir)

  return dir
}

function runSnippet(code: string, env: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync('bash', ['-c', `source scripts/build-work.sh\n${code}`], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

function lastLine(text: string) {
  return text.trim().split(/\r?\n/).at(-1) ?? ''
}

function fakeGetconf(cores: number) {
  const bin = path.join(tempDir(), 'bin')

  fs.mkdirSync(bin)

  fs.writeFileSync(path.join(bin, 'getconf'), `#!/usr/bin/env bash\nprintf '%s\\n' ${cores}\n`, {
    mode: 0o755,
  })

  return bin
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('resolve_work', () => {
  it.skipIf(isWindows)('picks the tool subfolder under UPAI_BUILD_WORK_DIR', () => {
    const root = tempDir()

    const result = runSnippet(
      'resolve_work node node 24.22.1-small-icu fallback 1\nprintf %s "$WORK"',
      { UPAI_BUILD_WORK_DIR: root },
    )

    expect(result.status).toBe(0)
    expect(lastLine(result.stdout)).toBe(path.join(root, 'node', '24.22.1-small-icu'))
  })

  it.skipIf(isWindows)('keeps the fallback when the variable is unset', () => {
    const result = runSnippet(
      'resolve_work node node 24.22.1-small-icu /cache/work 1\nprintf %s "$WORK"',
      {
        UPAI_BUILD_WORK_DIR: '',
      },
    )

    expect(result.status).toBe(0)
    expect(lastLine(result.stdout)).toBe('/cache/work')
  })

  it.skipIf(isWindows)('creates a missing directory', () => {
    const missing = path.join(tempDir(), 'missing')

    const result = runSnippet(
      'resolve_work node node 24.22.1-small-icu /cache/work 1\nprintf %s "$WORK"',
      { UPAI_BUILD_WORK_DIR: missing },
    )

    expect(result.status).toBe(0)
    expect(fs.statSync(missing).isDirectory()).toBe(true)
    expect(lastLine(result.stdout)).toBe(path.join(missing, 'node', '24.22.1-small-icu'))
  })

  it.skipIf(isWindows)('refuses a directory whose parent cannot be created', () => {
    const file = path.join(tempDir(), 'file')
    const blocked = path.join(file, 'work')

    fs.writeFileSync(file, '')

    const result = runSnippet('resolve_work node node 24.22.1-small-icu /cache/work 1', {
      UPAI_BUILD_WORK_DIR: blocked,
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`cannot create UPAI_BUILD_WORK_DIR: ${blocked}`)
    expect(result.stderr).toContain('free')
    expect(result.stderr).toContain('needed')
  })

  it.skipIf(isWindows)('refuses a directory without enough room', () => {
    const root = tempDir()

    const result = runSnippet('resolve_work node node 24.22.1-small-icu /cache/work 999999999999', {
      UPAI_BUILD_WORK_DIR: root,
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('not enough space')
    expect(result.stdout).toContain('needed')
  })
})

function filledWorkTree() {
  const work = path.join(tempDir(), 'work')

  fs.mkdirSync(path.join(work, 'out'), { recursive: true })
  fs.writeFileSync(path.join(work, 'out', 'object'), 'x'.repeat(4096))

  return work
}

describe('cleanup_work', () => {
  it.skipIf(isWindows)('removes the tree and reports the freed size', () => {
    const work = filledWorkTree()

    const result = runSnippet('CLEAN_WORK=1\ncleanup_work node "$WORK_TEST" 0', { WORK_TEST: work })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('freed')
    expect(fs.existsSync(work)).toBe(false)
  })

  it.skipIf(isWindows)('keeps the tree with --keep-work', () => {
    const work = filledWorkTree()

    const result = runSnippet('CLEAN_WORK=1\ncleanup_work node "$WORK_TEST" 1', { WORK_TEST: work })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('keeping')
    expect(fs.readFileSync(path.join(work, 'out', 'object'), 'utf8')).toHaveLength(4096)
  })

  it.skipIf(isWindows)('keeps the cache work tree when the variable is unset', () => {
    const work = filledWorkTree()

    const result = runSnippet('CLEAN_WORK=0\ncleanup_work node "$WORK_TEST" 0', { WORK_TEST: work })

    expect(result.status).toBe(0)
    expect(fs.existsSync(work)).toBe(true)
  })
})

describe('build_jobs', () => {
  it.skipIf(isWindows)('caps many cores at four', () => {
    const bin = fakeGetconf(12)

    const result = runSnippet('build_jobs node "" NODE_BUILD_JOBS\nprintf %s "$JOBS"', {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    })

    expect(result.status).toBe(0)
    expect(lastLine(result.stdout)).toBe('4')
  })

  it.skipIf(isWindows)('keeps fewer cores as they are', () => {
    const bin = fakeGetconf(2)

    const result = runSnippet('build_jobs node "" NODE_BUILD_JOBS\nprintf %s "$JOBS"', {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    })

    expect(result.status).toBe(0)
    expect(lastLine(result.stdout)).toBe('2')
  })

  it.skipIf(isWindows)('honours the override', () => {
    const bin = fakeGetconf(12)

    const result = runSnippet('build_jobs node 7 NODE_BUILD_JOBS\nprintf %s "$JOBS"', {
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    })

    expect(result.status).toBe(0)
    expect(lastLine(result.stdout)).toBe('7')
  })

  it.skipIf(isWindows)('rejects a zero override', () => {
    const result = runSnippet('build_jobs node 0 NODE_BUILD_JOBS')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('NODE_BUILD_JOBS must be a positive integer')
  })
})

describe('build scripts', () => {
  const SCRIPTS = ['scripts/node/build-unix.sh', 'scripts/ffmpeg/build-unix.sh'] as const

  it.each(SCRIPTS)('%s sources the shared helper and accepts --keep-work', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    expect(text).toContain('source "$SCRIPT_DIR/../build-work.sh"')
    expect(text).toContain('--keep-work) KEEP_WORK=1; shift ;;')
    expect(text).toContain('cleanup_work ')
  })

  it('caps Node and ffmpeg jobs through their overrides', () => {
    const node = fs.readFileSync(path.resolve(SCRIPTS[0]), 'utf8')
    const ffmpeg = fs.readFileSync(path.resolve(SCRIPTS[1]), 'utf8')

    expect(node).toContain('build_jobs node "${NODE_BUILD_JOBS:-}" NODE_BUILD_JOBS')
    expect(ffmpeg).toContain('build_jobs ffmpeg "${FFMPEG_BUILD_JOBS:-}" FFMPEG_BUILD_JOBS')
  })
})
