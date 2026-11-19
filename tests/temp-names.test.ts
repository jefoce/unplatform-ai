import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const TEMP_WRITERS = [
  'src/server/media/thumbs.ts',
  'src/server/media/compat.ts',
  'src/app/api/generations/[id]/frame/route.ts',
  'src/server/services/uploads.ts',
]

describe('temp names', () => {
  it('builds the marker every sweep matches', async () => {
    const { tempSuffix } = await import('@/server/paths')

    expect(tempSuffix()).toMatch(
      /^\.tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it.each(TEMP_WRITERS)('%s names its temp file with the shared suffix', async (file) => {
    const text = await fs.readFile(path.join(process.cwd(), file), 'utf8')

    expect(text).toContain('tempSuffix()')
    expect(text).not.toMatch(/\.tmp\.[a-z]/)
  })
})
