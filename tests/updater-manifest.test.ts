import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  assetNames,
  buildManifest,
  extractNotes,
  ManifestSchema,
} from '../.github/scripts/updater-manifest.mjs'

const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/updater/', import.meta.url))
const VERSION = '9.9.9'
const TAG = 'v9.9.9-rc.1'
const PUB_DATE = '2026-11-01T12:00:00Z'
const NOTES = '### Added\n\n- Fake feature for the manifest test.\n\n### Fixed\n\n- Fake bug.'

const ASSETS = assetNames(VERSION)
const CHANGELOG = fs.readFileSync(path.join(FIXTURE_DIR, 'CHANGELOG.md'), 'utf8')

function readSignature(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, `${name}.sig`), 'utf8').trim()
}

const SIGNATURES = {
  darwinAarch64: readSignature(ASSETS.darwinAarch64),
  windowsX8664: readSignature(ASSETS.windowsX8664),
  linuxX8664: readSignature(ASSETS.linuxX8664),
}

function build() {
  return buildManifest({
    version: VERSION,
    changelog: CHANGELOG,
    pubDate: PUB_DATE,
    tag: TAG,
    assets: ASSETS,
    signatures: SIGNATURES,
  })
}

describe('updater manifest', () => {
  it('builds the exact manifest object', () => {
    expect(build()).toEqual({
      version: '9.9.9',
      notes: NOTES,
      pub_date: '2026-11-01T12:00:00Z',
      platforms: {
        'darwin-aarch64': {
          signature: 'c2lnbmF0dXJlLW1hY29zLWFybTY0',
          url: 'https://github.com/jefoce/unplatform-ai/releases/download/v9.9.9-rc.1/unplatform-ai-9.9.9-macos-arm64.app.tar.gz',
        },
        'windows-x86_64': {
          signature: 'c2lnbmF0dXJlLXdpbmRvd3MteDg2NDY0',
          url: 'https://github.com/jefoce/unplatform-ai/releases/download/v9.9.9-rc.1/unplatform-ai-9.9.9-windows-x64-setup.exe',
        },
        'linux-x86_64': {
          signature: 'c2lnbmF0dXJlLWxpbnV4LXg4Nl82NA==',
          url: 'https://github.com/jefoce/unplatform-ai/releases/download/v9.9.9-rc.1/unplatform-ai-9.9.9-linux-x64.AppImage',
        },
      },
    })
  })

  it('extracts the notes of one version section', () => {
    expect(extractNotes(CHANGELOG, VERSION)).toBe(NOTES)

    expect(extractNotes(CHANGELOG, '9.9.8')).toBe(
      'Old notes that must not leak into the newer section.',
    )
  })

  it('falls back to the base version for a prerelease', () => {
    expect(extractNotes(CHANGELOG, '9.9.9-rc.1')).toBe(NOTES)
  })

  it('falls back to the base version for a build suffix', () => {
    expect(extractNotes(CHANGELOG, '9.9.9+build.4')).toBe(NOTES)
  })

  it('falls back when the version section is absent', () => {
    expect(extractNotes(CHANGELOG, '0.0.1')).toBe('See CHANGELOG.md')
    expect(extractNotes(CHANGELOG, '0.0.1-rc.1')).toBe('See CHANGELOG.md')
  })

  it('uses explicit notes over the changelog', () => {
    const manifest = buildManifest({
      version: VERSION,
      changelog: CHANGELOG,
      notes: 'Custom notes',
      pubDate: PUB_DATE,
      tag: TAG,
      assets: ASSETS,
      signatures: SIGNATURES,
    })

    expect(manifest.notes).toBe('Custom notes')
  })

  it('rejects a non-https url', () => {
    const manifest = build()

    const bad = {
      ...manifest,
      platforms: {
        ...manifest.platforms,
        'darwin-aarch64': {
          ...manifest.platforms['darwin-aarch64'],
          url: 'http://example.com/latest.app.tar.gz',
        },
      },
    }

    expect(ManifestSchema.safeParse(bad).success).toBe(false)
  })
})
