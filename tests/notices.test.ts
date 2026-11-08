import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkAppLicense,
  checkBundled,
  checkLicenseLinks,
  checkNpmSection,
  gstreamerSection,
  libvipsBundle,
  libvipsSection,
} from '../scripts/notices.mjs'

interface PackageJson {
  license: string
}

const NOTICES = fs.readFileSync(path.resolve('THIRD_PARTY_NOTICES.md'), 'utf8')
const TAURI = fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')
const PACKAGE = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as PackageJson
const NPM_START = '<!-- npm-licenses:start -->'
const NPM_END = '<!-- npm-licenses:end -->'
const NPM_SECTION = '## npm production dependencies\n\n### MIT\n\n- left-pad 1.3.0'

/** Notices document with one npm section between the markers. */
function noticesWithNpm(section: string): string {
  return `# Third-party notices\n\n${NPM_START}\n\n${section}\n\n${NPM_END}\n`
}

const FIXTURE_VERSIONS = { vips: '8.18.7', glib: '2.90.0', cairo: '1.18.6' }

const FIXTURE_README = [
  '# fixture',
  '',
  '| Library | Used under the terms of |',
  '|---------|-------------------------|',
  '| libvips | LGPLv3                  |',
  '| glib    | LGPLv3                  |',
  '| cairo   | Mozilla Public License 1.1 |',
].join('\n')

/** Installed package directory with the three files the notices reader needs. */
function writeLibvipsFixture(imageDir: string, name: string): void {
  const dir = path.join(imageDir, name)

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'versions.json'), JSON.stringify(FIXTURE_VERSIONS))
  fs.writeFileSync(path.join(dir, 'README.md'), FIXTURE_README)
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.3.4' }))
}

describe('third-party notices', () => {
  it('matches the bundled sharp, libvips and licensing rows', async () => {
    await expect(checkBundled(NOTICES)).resolves.toBeUndefined()
  })

  it('matches the package.json license', () => {
    expect(() => {
      checkAppLicense(NOTICES, PACKAGE.license)
    }).not.toThrow()
  })

  it('passes when the app license line matches', () => {
    const text = `Unplatform AI itself is licensed under ${PACKAGE.license}. See [LICENSE](LICENSE).`

    expect(() => {
      checkAppLicense(text, PACKAGE.license)
    }).not.toThrow()
  })

  it('fails when the app license line disagrees', () => {
    const text = 'Unplatform AI itself is MIT licensed. See [LICENSE](LICENSE).'

    expect(() => {
      checkAppLicense(text, PACKAGE.license)
    }).toThrow('app license must say')
  })

  it('passes when the npm section is current', () => {
    expect(() => {
      checkNpmSection(noticesWithNpm(NPM_SECTION), NPM_SECTION)
    }).not.toThrow()
  })

  it('fails when the npm section is stale', () => {
    const stale = `${NPM_SECTION}\n- stale-package 9.9.9`

    expect(() => {
      checkNpmSection(noticesWithNpm(stale), NPM_SECTION)
    }).toThrow('npm section is stale')
  })

  it('fails when a notice link points at a missing license file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-'))

    try {
      await expect(
        checkLicenseLinks('See [licenses/MISSING.txt](licenses/MISSING.txt).', dir),
      ).rejects.toThrow('licenses/MISSING.txt')
    } finally {
      fs.rmdirSync(dir)
    }
  })

  it('ships the GPL and LGPL license texts', () => {
    const gpl = fs.readFileSync(path.resolve('licenses/COPYING.GPLv3'), 'utf8')
    const lgpl = fs.readFileSync(path.resolve('licenses/COPYING.LGPLv2.1'), 'utf8')

    expect(gpl).toContain('Version 3, 29 June 2007')
    expect(lgpl).toContain('Version 2.1, February 1999')
  })

  it('lists the libvips bundle with glib and cairo licenses', async () => {
    const section = await libvipsSection()

    expect(section).toContain('| glib')
    expect(section).toContain('LGPL-3.0-or-later')
    expect(section).toContain('| cairo')
    expect(section).toContain('MPL-1.1')
    expect(section).toContain('libvips')
  })

  it('lists the AppImage GStreamer plugins with source links', () => {
    const section = gstreamerSection()

    expect(section).toContain('gst-plugins-good')
    expect(section).toContain('gst-plugins-bad')
    expect(section).toContain('gst-libav')
    expect(section).toContain('LGPL-2.1-or-later')
    expect(section).toContain('https://gitlab.freedesktop.org/gstreamer/gst-plugins-good')
  })

  it('keeps the media framework in the AppImage', () => {
    expect(TAURI).toContain('"bundleMediaFramework": true')
  })
})

describe('libvips package lookup', () => {
  it('reads libvips from a separate package', async () => {
    const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-libvips-'))

    try {
      writeLibvipsFixture(imageDir, 'sharp-libvips-darwin-arm64')
      const bundle = await libvipsBundle(imageDir, 'darwin', 'arm64')

      expect(bundle.versions).toEqual(FIXTURE_VERSIONS)
      expect(bundle.version).toBe('1.3.4')
      expect(bundle.licenses.get('libvips')).toBe('LGPLv3')
    } finally {
      fs.rmSync(imageDir, { recursive: true, force: true })
    }
  })

  it('reads libvips from the Windows sharp package', async () => {
    const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-libvips-'))

    try {
      writeLibvipsFixture(imageDir, 'sharp-win32-x64')
      const bundle = await libvipsBundle(imageDir, 'win32', 'x64')

      expect(bundle.versions).toEqual(FIXTURE_VERSIONS)
      expect(bundle.version).toBe('1.3.4')
      expect(bundle.licenses.get('libvips')).toBe('LGPLv3')
    } finally {
      fs.rmSync(imageDir, { recursive: true, force: true })
    }
  })

  it('fails when no libvips package is installed', async () => {
    const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-libvips-'))

    try {
      await expect(libvipsBundle(imageDir, 'win32', 'x64')).rejects.toThrow(
        'Missing @img/sharp-libvips-win32-x64 or @img/sharp-win32-x64 package',
      )
    } finally {
      fs.rmSync(imageDir, { recursive: true, force: true })
    }
  })
})
