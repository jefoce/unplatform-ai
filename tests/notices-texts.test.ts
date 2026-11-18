import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  cargoPackages,
  checkCargoLicenseTexts,
  checkLicenseTexts,
  sourceOfferSection,
} from '../scripts/notices.mjs'

const RELEASE_DRAFT = path.resolve('.github/scripts/release-draft.sh')

describe('third-party license texts', () => {
  it('fails the npm check when a committed text is removed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-npm-'))

    const entries = new Map([
      ['kept.txt', 'text'],
      ['removed.txt', 'text'],
    ])

    try {
      fs.writeFileSync(path.join(dir, 'kept.txt'), 'text')

      await expect(checkLicenseTexts(entries, dir, 'licenses/npm')).rejects.toThrow(
        'licenses/npm/removed.txt is missing',
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails the cargo check when a crate text is removed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-cargo-'))

    const lock = [
      '[[package]]',
      'name = "serde"',
      'version = "1.0.0"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
    ].join('\n')

    try {
      await expect(checkCargoLicenseTexts(lock, dir)).rejects.toThrow(
        'licenses/cargo/serde-1.0.0.txt is missing',
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('drops workspace crates from the cargo check', () => {
    const lock = [
      '[[package]]',
      'name = "app"',
      'version = "0.5.2"',
      '',
      '[[package]]',
      'name = "serde"',
      'version = "1.0.0"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
    ].join('\n')

    expect(cargoPackages(lock)).toEqual([{ name: 'serde', version: '1.0.0' }])
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
