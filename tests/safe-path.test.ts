import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { isInside, joinInside, resolveInside, SafePathError } from '@/server/fs/safe-path'

const root = path.resolve('/srv/storage')

describe('resolveInside', () => {
  it('resolves nested paths inside the root', () => {
    expect(resolveInside(root, 'downloads/video.mp4')).toBe(
      path.join(root, 'downloads', 'video.mp4'),
    )
  })

  it('returns the root itself for empty or dot paths', () => {
    expect(resolveInside(root, '')).toBe(root)
    expect(resolveInside(root, '.')).toBe(root)
  })

  it('rejects parent traversal', () => {
    expect(() => resolveInside(root, '../secret')).toThrow(SafePathError)
    expect(() => resolveInside(root, 'downloads/../../secret')).toThrow(SafePathError)
  })

  it('rejects absolute paths outside the root', () => {
    expect(() => resolveInside(root, '/etc/passwd')).toThrow(SafePathError)
  })

  it('does not URL-decode percent segments', () => {
    const resolved = resolveInside(root, '..%2f..%2fetc')

    expect(resolved).toBe(path.join(root, '..%2f..%2fetc'))
    expect(isInside(root, resolved)).toBe(true)
  })

  it('rejects null bytes', () => {
    expect(() => resolveInside(root, 'a\0b')).toThrow(SafePathError)
  })

  it.skipIf(process.platform === 'win32')('keeps backslash segments literal on posix', () => {
    const resolved = resolveInside(root, '..\\..\\etc')

    expect(resolved).toBe(path.join(root, '..\\..\\etc'))
    expect(isInside(root, resolved)).toBe(true)
  })

  it('handles unicode names', () => {
    expect(resolveInside(root, 'vidéos/日本語.mp4')).toBe(path.join(root, 'vidéos', '日本語.mp4'))
  })
})

describe('isInside', () => {
  it('detects paths inside and outside the root', () => {
    expect(isInside(root, path.join(root, 'a'))).toBe(true)
    expect(isInside(root, root)).toBe(true)
    expect(isInside(root, path.resolve(root, '..'))).toBe(false)
    expect(isInside(root, `${root}-backup`)).toBe(false)
  })
})

describe('joinInside', () => {
  it('joins and normalizes segments', () => {
    expect(joinInside(root, 'downloads', 'nested', '..', 'video.mp4')).toBe(
      path.join(root, 'downloads', 'video.mp4'),
    )
  })

  it('rejects absolute segments', () => {
    expect(() => joinInside(root, 'downloads', '/etc')).toThrow(SafePathError)
  })
})
