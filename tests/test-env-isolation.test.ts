import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

const realHomeRoot = path.join(process.env.UPAI_REAL_HOME ?? '', '.unplatform-ai')

function isUnderTmp(value: string | undefined): boolean {
  if (isNil(value)) {
    return false
  }

  const relative = path.relative(os.tmpdir(), path.resolve(value))

  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

describe('test environment isolation', () => {
  it('points STORAGE_ROOT under the temp directory', () => {
    expect(isUnderTmp(process.env.STORAGE_ROOT)).toBe(true)
  })

  it('points the home directory under the temp directory', () => {
    expect(isUnderTmp(os.homedir())).toBe(true)
  })

  it('does not use the real home root', () => {
    expect(process.env.STORAGE_ROOT).not.toBe(realHomeRoot)
    expect(os.homedir()).not.toBe(realHomeRoot)
  })
})
