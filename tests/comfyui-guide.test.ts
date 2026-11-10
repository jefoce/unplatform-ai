import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CUSTOM_FORBIDDEN_MESSAGE,
  CUSTOM_MISSING_MESSAGE,
  CUSTOM_OFFLINE_MESSAGE,
  CUSTOM_PROTOCOL_MESSAGE,
  CUSTOM_QUOTA_MESSAGE,
  CUSTOM_STALE_MESSAGE,
  CUSTOM_TOKEN_MESSAGE,
} from '../src/core/providers/custom-messages'

const GUIDE = fs.readFileSync(path.resolve('docs/user/COMFYUI.md'), 'utf8')

const GUIDE_MESSAGES = [
  CUSTOM_TOKEN_MESSAGE,
  CUSTOM_FORBIDDEN_MESSAGE,
  CUSTOM_OFFLINE_MESSAGE,
  CUSTOM_PROTOCOL_MESSAGE,
  CUSTOM_QUOTA_MESSAGE,
  CUSTOM_MISSING_MESSAGE,
  CUSTOM_STALE_MESSAGE,
]

describe('COMFYUI guide', () => {
  it.each(GUIDE_MESSAGES)('mentions %s', (message) => {
    expect(GUIDE).toContain(message)
  })
})
