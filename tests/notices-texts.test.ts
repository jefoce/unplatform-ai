import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  checkLicenseArchiveContent,
  checkLicenseDocument,
  sourceOfferSection,
} from '../scripts/notices.mjs'

const RELEASE_DRAFT = path.resolve('.github/scripts/release-draft.sh')
const ARCHIVE = path.resolve('THIRD_PARTY_LICENSES.txt.gz')
const SEPARATOR = '='.repeat(80)

/**
 * Committed archive decompressed as UTF-8.
 */
function archiveText(): string {
  return gunzipSync(fs.readFileSync(ARCHIVE)).toString('utf8')
}

/**
 * Small document in the generated format, one package and one text block.
 */
function fixtureDocument(body: string): string {
  return [
    'Third-party license texts',
    '=========================',
    '',
    'Contents',
    '--------',
    '',
    'Package | Version | Text',
    '------- | ------- | ----',
    'left-pad | 1.3.0 | 1',
    '',
    SEPARATOR,
    '1. MIT License',
    SEPARATOR,
    '',
    'Packages:',
    '  left-pad 1.3.0',
    '    Copyright (c) 2018 Example',
    '',
    body,
    '',
  ].join('\n')
}

describe('third-party license archive', () => {
  it('ships a deterministic gzip that decompresses to the committed text', () => {
    const raw = fs.readFileSync(ARCHIVE)
    const text = archiveText()

    expect(raw.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
    expect(text).toBe(fs.readFileSync(path.resolve('THIRD_PARTY_LICENSES.txt'), 'utf8'))
  })

  it('lists react from npm and tauri from cargo', () => {
    const text = archiveText()

    expect(text).toMatch(/^react\s+\| \d+\.\d+\.\d+\s+\| +\d+$/m)
    expect(text).toMatch(/^tauri\s+\| \d+\.\d+\.\d+\s+\| +\d+$/m)
    expect(text).not.toMatch(/^serde_derive\s+\|/m)
  })

  it('gives every table of contents package a text block', () => {
    expect(() => {
      checkLicenseDocument(archiveText())
    }).not.toThrow()
  })

  it('fails when a license text block is removed', () => {
    expect(() => {
      checkLicenseDocument(fixtureDocument('Permission is hereby granted, free of charge.'))
    }).not.toThrow()

    expect(() => {
      checkLicenseDocument(fixtureDocument(''))
    }).toThrow('has no license text')
  })
})

describe('third-party license archive check', () => {
  const sample = fixtureDocument('Permission is hereby granted, free of charge.')

  /**
   * Sample gzipped at one level, like a runner with a different zlib build.
   */
  function sampleArchive(level: number): Buffer {
    return gzipSync(Buffer.from(sample, 'utf8'), { level })
  }

  it('accepts the same text from another zlib build', () => {
    const fast = sampleArchive(1)
    const best = sampleArchive(9)
    const foreign = Buffer.from(best)

    foreign[9] = 3 // OS byte: Unix instead of the current host

    expect(fast.equals(best)).toBe(false)

    for (const archive of [fast, best, foreign]) {
      expect(() => {
        checkLicenseArchiveContent(archive, sample)
      }).not.toThrow()
    }
  })

  it('fails when the archive holds another text', () => {
    const stale = gzipSync(Buffer.from(fixtureDocument(''), 'utf8'), { level: 9 })

    expect(() => {
      checkLicenseArchiveContent(stale, sample)
    }).toThrow('is stale')
  })
})

describe('third-party source offer', () => {
  it('offers the libvips and GStreamer source with exact versions', async () => {
    const section = await sourceOfferSection()

    expect(section).toContain('LGPL-3.0-or-later')
    expect(section).toContain('LGPL-2.0-or-later')
    expect(section).toMatch(/\| libvips\s+\| \d+\.\d+\.\d+/)
    expect(section).toMatch(/\| GStreamer\s+\| \d+\.\d+\.\d+/)
    expect(section).toContain('https://github.com/libvips/libvips/archive/refs/tags/')
    expect(section).toContain('https://gstreamer.freedesktop.org/src/gstreamer/gstreamer-')
    expect(section).toContain('https://github.com/jefoce/unplatform-ai/issues')
  })

  it('keeps the source offer in the release notes template', () => {
    const draft = fs.readFileSync(RELEASE_DRAFT, 'utf8')

    expect(draft).toContain('Source code offer')
    expect(draft).toContain('https://github.com/jefoce/unplatform-ai/issues')
  })
})
