import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkBundled,
  checkLicenseLinks,
  checkNpmSection,
  gstreamerSection,
  libvipsSection,
} from '../scripts/notices.mjs'

const NOTICES = fs.readFileSync(path.resolve('THIRD_PARTY_NOTICES.md'), 'utf8')
const TAURI = fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')
const NPM_START = '<!-- npm-licenses:start -->'
const NPM_END = '<!-- npm-licenses:end -->'
const NPM_SECTION = '## npm production dependencies\n\n### MIT\n\n- left-pad 1.3.0'

/** Notices document with one npm section between the markers. */
function noticesWithNpm(section: string): string {
  return `# Third-party notices\n\n${NPM_START}\n\n${section}\n\n${NPM_END}\n`
}

describe('third-party notices', () => {
  it('matches the bundled sharp, libvips and licensing rows', async () => {
    await expect(checkBundled(NOTICES)).resolves.toBeUndefined()
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
