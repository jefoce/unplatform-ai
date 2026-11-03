import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupTempDirs,
  fakeGhEnv,
  parseOutput,
  runNodeScript,
  runScript,
  tempDir,
  writeFiles,
} from './helpers/ci-scripts'

const sha256 = (text: string): string => {
  return createHash('sha256').update(text).digest('hex')
}

afterEach(cleanupTempDirs)

describe('checksums.sh', () => {
  it.skipIf(process.platform === 'win32')('builds one checksum file per target', () => {
    const root = tempDir()
    const dist = path.join(root, 'dist')

    writeFiles(dist, ['a.zip', 'b.zip'])

    const result = runScript({
      script: 'checksums.sh',
      args: ['build', 'x86_64-unknown-linux-gnu', dist],
      cwd: root,
    })

    expect(result.status).toBe(0)

    const sums = fs.readFileSync(path.join(root, 'sha256-x86_64-unknown-linux-gnu.txt'), 'utf8')

    expect(sums).toContain(`${sha256('a.zip')}  a.zip`)
    expect(sums).toContain(`${sha256('b.zip')}  b.zip`)
  })

  it.skipIf(process.platform === 'win32')('merges installer sums with ffmpeg sources', () => {
    const root = tempDir()
    const dist = path.join(root, 'dist')
    const sources = path.join(root, 'sources')

    writeFiles(dist, ['sha256-linux.txt', 'sha256-macos.txt'])
    writeFiles(sources, ['ffmpeg.tar.xz', 'x264.tar.bz2'])

    const result = runScript({
      script: 'checksums.sh',
      args: ['merge', dist, sources],
      cwd: root,
    })

    expect(result.status).toBe(0)

    const lines = fs.readFileSync(path.join(root, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')

    expect(lines).toHaveLength(4)
    expect([...lines].sort()).toEqual(lines)
    expect(result.stdout.trim().split('\n')).toEqual(lines)
  })

  it.skipIf(process.platform === 'win32')('fails when no source archive exists', () => {
    const root = tempDir()
    const dist = path.join(root, 'dist')
    const sources = path.join(root, 'sources')

    writeFiles(dist, ['sha256-linux.txt'])
    fs.mkdirSync(sources)

    const result = runScript({
      script: 'checksums.sh',
      args: ['merge', dist, sources],
      cwd: root,
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('no ffmpeg source archives found')
  })
})

describe('release-draft.sh', () => {
  it.skipIf(process.platform === 'win32')('replaces the matching draft and prints its id', () => {
    const { root, env } = fakeGhEnv()

    const result = runScript({
      script: 'release-draft.sh',
      cwd: root,
      env: {
        ...env,
        TAG: 'v0.4.0',
        PRERELEASE: 'true',
        GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
        GITHUB_SHA: 'abc123',
      },
    })

    expect(result.status).toBe(0)
    expect(parseOutput(result.stdout)).toEqual({ id: '99' })

    const log = fs.readFileSync(path.join(root, 'gh.log'), 'utf8')

    expect(log).toContain('releases/17')
    expect(log).toContain('-X DELETE')
    expect(log).toContain('tag_name=v0.4.0')
    expect(log).toContain('target_commitish=abc123')
    expect(log).toContain('prerelease=true')
  })
})

describe('upload-release-assets.sh', () => {
  it.skipIf(process.platform === 'win32')('deletes same-name assets before uploading', () => {
    const root = tempDir()
    const assets = path.join(root, 'assets')

    writeFiles(assets, ['a.zip'])

    const result = runScript({
      script: 'upload-release-assets.sh',
      args: ['99', path.join(assets, 'a.zip')],
      env: { ...fakeGhEnv().env, GITHUB_REPOSITORY: 'jefoce/unplatform-ai' },
    })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('a.zip')
  })

  it.skipIf(process.platform === 'win32')('rejects a name that needs URL encoding', () => {
    const root = tempDir()
    const assets = path.join(root, 'assets')
    const file = path.join(assets, 'bad name.zip')

    writeFiles(assets, ['bad name.zip'])

    const result = runScript({
      script: 'upload-release-assets.sh',
      args: ['99', file],
      env: { ...fakeGhEnv().env, GITHUB_REPOSITORY: 'jefoce/unplatform-ai' },
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('asset name needs URL encoding')
  })
})

describe('sidecar-manifest.mjs', () => {
  it('writes and verifies a sidecar manifest', () => {
    const root = tempDir()
    const binary = path.join(root, 'unplatform-ai-server')
    const manifest = path.join(root, 'manifest.json')

    fs.writeFileSync(binary, 'server')

    const write = runNodeScript({
      script: 'sidecar-manifest.mjs',
      args: ['write', binary, manifest, 'node', 'x86_64-unknown-linux-gnu', '0.4.0', 'full'],
    })

    expect(write.status).toBe(0)

    expect(JSON.parse(fs.readFileSync(manifest, 'utf8'))).toEqual({
      name: 'node',
      target: 'x86_64-unknown-linux-gnu',
      version: '0.4.0',
      sha256: sha256('server'),
      profile: 'full',
    })

    const verify = runNodeScript({
      script: 'sidecar-manifest.mjs',
      args: ['verify', binary, manifest],
    })

    expect(verify.status).toBe(0)

    fs.writeFileSync(binary, 'other')

    const mismatch = runNodeScript({
      script: 'sidecar-manifest.mjs',
      args: ['verify', binary, manifest],
    })

    expect(mismatch.status).not.toBe(0)
    expect(mismatch.stderr).toContain('sidecar sha256 mismatch')
  })
})

describe('sources-manifest.mjs', () => {
  it('hashes every source file in sorted order', () => {
    const root = tempDir()
    const sources = path.join(root, 'sources')

    writeFiles(sources, ['ffmpeg.tar.xz', 'x264.tar.bz2'])

    const result = runNodeScript({
      script: 'sources-manifest.mjs',
      args: [sources, 'ffmpeg-9.0.2'],
    })

    expect(result.status).toBe(0)

    const manifest = JSON.parse(
      fs.readFileSync(path.join(sources, 'ffmpeg-sources-manifest.json'), 'utf8'),
    )

    expect(manifest).toEqual({
      tag: 'ffmpeg-9.0.2',
      files: {
        'ffmpeg.tar.xz': sha256('ffmpeg.tar.xz'),
        'x264.tar.bz2': sha256('x264.tar.bz2'),
      },
    })
  })
})
