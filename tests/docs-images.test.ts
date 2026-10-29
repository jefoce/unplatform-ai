import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { imageTargets } from './helpers/image-targets'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** R2 guide images in reading order. */
const R2_GUIDE_IMAGES = [
  'cloudflare-r2-step-1.png',
  'cloudflare-r2-step-2.png',
  'cloudflare-r2-step-3.png',
  'cloudflare-r2-api-step-1.png',
  'cloudflare-r2-api-step-2.png',
  'cloudflare-r2-api-step-3.png',
  'cloudflare-r2-api-step-4.png',
  'cloudflare-r2-lifecycle-rule.png',
]

const file = (rel: string) => {
  return path.join(ROOT, rel)
}

describe('user guides', () => {
  it('keeps the R2 guide images in reading order', () => {
    const guide = fs.readFileSync(file('docs/user/CLOUDFLARE-R2.md'), 'utf8')

    const names = imageTargets(guide)
      .filter((target) => {
        return target.includes('cloudflare-r2-')
      })
      .map((target) => {
        return path.basename(target)
      })

    expect(names).toEqual(R2_GUIDE_IMAGES)
  })
})
