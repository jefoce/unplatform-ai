/* eslint-disable max-lines -- CI script and workflow checks stay in one suite */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupTempDirs,
  fakeOrasEnv,
  gitRepo,
  jobsMissingCheckout,
  parseOutput,
  runScript,
  tempDir,
  writeFiles,
} from './helpers/ci-scripts'

interface RenameCase {
  target: string
  files: string[]
  expected: string[]
}

interface VersionCase {
  name: string
  subject: string
  env: Partial<NodeJS.ProcessEnv>
  expected?: Record<string, string>
  error?: string
}

interface PlanCase {
  name: string
  restore: string
  sources: string
  target: string
  expected: Record<string, string>
}

const RENAME_CASES: RenameCase[] = [
  {
    target: 'aarch64-apple-darwin',
    files: ['App.dmg', 'App.app.tar.gz', 'App.app.tar.gz.sig'],
    expected: [
      'unplatform-ai-0.2.0-macos-arm64.app.tar.gz',
      'unplatform-ai-0.2.0-macos-arm64.app.tar.gz.sig',
      'unplatform-ai-0.2.0-macos-arm64.dmg',
    ],
  },
  {
    target: 'x86_64-pc-windows-msvc',
    files: ['App-setup.exe', 'App-setup.exe.sig'],
    expected: [
      'unplatform-ai-0.2.0-windows-x64-setup.exe',
      'unplatform-ai-0.2.0-windows-x64-setup.exe.sig',
    ],
  },
  {
    target: 'x86_64-unknown-linux-gnu',
    files: ['App.AppImage', 'App.AppImage.sig', 'App.deb', 'App.rpm'],
    expected: [
      'unplatform-ai-0.2.0-linux-x64.AppImage',
      'unplatform-ai-0.2.0-linux-x64.AppImage.sig',
      'unplatform-ai-0.2.0-linux-x64.deb',
      'unplatform-ai-0.2.0-linux-x64.rpm',
    ],
  },
]

const BASE_ENV: Partial<NodeJS.ProcessEnv> = {
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF_TYPE: 'branch',
  GITHUB_REF_NAME: 'releases',
  TAG_INPUT: '',
}

const VERSION_CASES: VersionCase[] = [
  {
    name: 'accepts a matching dispatch rc tag',
    subject: '0.2.0',
    env: { GITHUB_EVENT_NAME: 'workflow_dispatch', TAG_INPUT: 'v0.2.0-rc.1' },
    expected: { version: '0.2.0', tag: 'v0.2.0-rc.1', prerelease: 'true' },
  },
  {
    name: 'rejects a dispatch tag from another version',
    subject: '0.2.0',
    env: { GITHUB_EVENT_NAME: 'workflow_dispatch', TAG_INPUT: 'v0.2.1-rc.1' },
    error: 'does not match version 0.2.0',
  },
  {
    name: 'accepts an rc tag push',
    subject: 'unrelated subject',
    env: { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.2.0-rc.2' },
    expected: { version: '0.2.0', tag: 'v0.2.0-rc.2', prerelease: 'true' },
  },
  {
    name: 'accepts a releases push with the version title',
    subject: '0.2.0',
    env: {},
    expected: { version: '0.2.0', tag: 'v0.2.0', prerelease: 'false' },
  },
  {
    name: 'rejects a releases push with another title',
    subject: 'Bump deps',
    env: {},
    error: "commit title 'Bump deps' is not '0.2.0'",
  },
]

const PLAN_CASES: PlanCase[] = [
  {
    name: 'keeps a restored Linux sidecar when the sources exist',
    restore: 'true',
    sources: 'true',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'false', out: 'ffmpeg-out' },
  },
  {
    name: 'rebuilds the Linux sources without touching ffmpeg-out',
    restore: 'true',
    sources: 'false',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'true', out: 'ffmpeg-rebuild' },
  },
  {
    name: 'builds into ffmpeg-out when the sidecar is missing',
    restore: 'false',
    sources: 'false',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'true', out: 'ffmpeg-out' },
  },
  {
    name: 'keeps a restored macOS sidecar without sources',
    restore: 'true',
    sources: 'false',
    target: 'aarch64-apple-darwin',
    expected: { build: 'false', out: 'ffmpeg-out' },
  },
]

afterEach(cleanupTempDirs)

describe('rename-installers.sh', () => {
  it.skipIf(process.platform === 'win32').each(RENAME_CASES)('names $target assets', (item) => {
    const root = tempDir()
    const bundle = path.join(root, 'bundle')
    const dist = path.join(root, 'dist')

    writeFiles(bundle, item.files)

    const result = runScript({
      script: 'rename-installers.sh',
      args: [bundle, '0.2.0', item.target, dist],
    })

    expect(result.status).toBe(0)
    expect(fs.readdirSync(dist).sort()).toEqual(item.expected.sort())
  })

  it.skipIf(process.platform === 'win32')('fails when a .sig is missing', () => {
    const root = tempDir()
    const bundle = path.join(root, 'bundle')

    writeFiles(bundle, ['App-setup.exe'])

    const result = runScript({
      script: 'rename-installers.sh',
      args: [bundle, '0.2.0', 'x86_64-pc-windows-msvc', path.join(root, 'dist')],
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('missing updater signature')
  })
})

describe('release-version.sh', () => {
  it.skipIf(process.platform === 'win32').each(VERSION_CASES)('$name', (item) => {
    const root = gitRepo(item.subject)

    const result = runScript({
      script: 'release-version.sh',
      cwd: root,
      env: { ...process.env, ...BASE_ENV, ...item.env },
    })

    if (!isNil(item.error)) {
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(item.error)

      return
    }

    expect(result.status).toBe(0)
    expect(parseOutput(result.stdout)).toEqual(item.expected)
  })
})

describe('ffmpeg-sources-tag.sh', () => {
  it.skipIf(process.platform === 'win32')('matches the inline versions.env tag', () => {
    const expected = execFileSync(
      'bash',
      [
        '-c',
        'source scripts/ffmpeg/versions.env; printf %s "ffmpeg-$FFMPEG_VERSION-x264-${X264_COMMIT:0:8}-zlib-$ZLIB_VERSION"',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    const result = runScript({ script: 'ffmpeg-sources-tag.sh' })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(expected)
  })
})

describe('ffmpeg-plan.sh', () => {
  it.skipIf(process.platform === 'win32').each(PLAN_CASES)('$name', (item) => {
    const output = path.join(tempDir(), 'output')

    const result = runScript({
      script: 'ffmpeg-plan.sh',
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        RESTORE_FOUND: item.restore,
        SOURCES_FOUND: item.sources,
        TARGET: item.target,
      },
    })

    expect(result.status).toBe(0)
    expect(parseOutput(fs.readFileSync(output, 'utf8'))).toEqual(item.expected)
  })
})

const WORKFLOW_FILES = ['.github/workflows/checks.yml', '.github/workflows/release.yml']

describe('workflow checkouts', () => {
  it.each(WORKFLOW_FILES)('%s checks out before using repo files', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    expect(jobsMissingCheckout(text)).toEqual([])
  })
})

describe('ghcr-pull.sh', () => {
  it.skipIf(process.platform === 'win32')('flattens the pulled tree', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:tag', 'cache', 'ffmpeg-x', 'manifest.json'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('found=true\n')
    expect(fs.existsSync(path.join(work, 'cache', 'ffmpeg-x'))).toBe(true)
    expect(fs.existsSync(path.join(work, 'cache', 'manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(work, 'cache', 'nested'))).toBe(false)
  })

  it.skipIf(process.platform === 'win32')('reports a missing required file', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:tag', 'cache', 'other'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('found=false\n')
    expect(result.stderr).toContain('GHCR tag incomplete')
  })

  it.skipIf(process.platform === 'win32')('reports a failed pull', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:missing', 'cache', 'ffmpeg-x'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('found=false\n')
  })
})
