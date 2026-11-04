import { describe, expect, it } from 'vitest'

import config from '../eslint.config.mjs'
import { importsRule, tester } from './eslint-rule-tester'

const SAVE_MESSAGE =
  'Write through updateGeneration/updateImage so the read and save share the lock.'

const saveBlock = config.find((block) => {
  return JSON.stringify(block.rules?.['no-restricted-imports'] ?? '').includes(SAVE_MESSAGE)
})

if (!saveBlock) {
  throw new Error('save write import rule missing')
}

const saveSetting = saveBlock.rules?.['no-restricted-imports']

if (!Array.isArray(saveSetting)) {
  throw new Error('save write import rule is not configured')
}

const saveOptions = saveSetting.slice(1)

tester.run('no-restricted-imports record writes', importsRule, {
  valid: [
    {
      name: 'update helper',
      code: "import { updateGeneration } from '../repos/generations'\nexport const fixture = updateGeneration\n",
      options: saveOptions,
    },
  ],
  invalid: [
    {
      name: 'relative save',
      code: "import { saveGeneration } from '../repos/generations'\nexport const fixture = saveGeneration\n",
      options: saveOptions,
      errors: [{ message: /Write through updateGeneration\/updateImage/ }],
    },
    {
      name: 'alias save',
      code: "import { saveImage } from '@/server/repos/images'\nexport const fixture = saveImage\n",
      options: saveOptions,
      errors: [{ message: /Write through updateGeneration\/updateImage/ }],
    },
  ],
})

describe('save write import scope', () => {
  it('applies to server files and skips the repos and the locked writers', () => {
    expect(saveBlock.files).toContain('src/server/**/*.ts')
    expect(saveBlock.ignores).toContain('src/server/repos/**/*.ts')

    const exception = config.find((block) => {
      return Array.isArray(block.files) && block.files.includes('src/server/repos/**/*.ts')
    })

    expect(exception).toBeDefined()
  })
})
