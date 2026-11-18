import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { stageResources } from '../scripts/notices.mjs'

describe('desktop resource staging', () => {
  it('stages the archive, notices, license and the eight originals only', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-resources-'))

    try {
      await stageResources(dir)

      expect(fs.readdirSync(dir).sort()).toEqual([
        'LICENSE',
        'THIRD_PARTY_LICENSES.txt.gz',
        'THIRD_PARTY_NOTICES.md',
        'licenses',
      ])

      expect(fs.readdirSync(path.join(dir, 'licenses')).sort()).toEqual([
        'COPYING.GPLv2',
        'COPYING.GPLv3',
        'COPYING.LGPLv2.1',
        'COPYING.x264',
        'LICENSE.lgpl3',
        'LICENSE.mingw-w64.txt',
        'LICENSE.node',
        'LICENSE.zlib',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
