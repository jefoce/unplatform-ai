import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { required } from './helpers/required'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const ConfigSchema = z.object({
  plugins: z.object({
    updater: z.object({ pubkey: z.string() }),
  }),
})

const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/)

/** Mirrors the plugin: base64 to minisign text, then the second line to a 42-byte key. */
function decodePublicKey(pubkey: string): Buffer {
  const text = Buffer.from(Base64Schema.parse(pubkey), 'base64').toString('utf8')

  const match =
    /^(untrusted comment: minisign public key: [0-9A-F]{16})\n([A-Za-z0-9+/]+={0,2})\n?$/.exec(text)

  const encoded = required(match?.[2], 'minisign key')

  return Buffer.from(Base64Schema.parse(encoded), 'base64')
}

describe('updater public key', () => {
  it('is the base64 blob of the minisign public key', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')
    const { plugins } = ConfigSchema.parse(JSON.parse(raw))
    const key = decodePublicKey(plugins.updater.pubkey)

    expect(key).toHaveLength(42)
    expect([key[0], key[1]]).toEqual([0x45, 0x64])

    // Minisign prints the key id little-endian.
    const keyId = Buffer.from(key.subarray(2, 10)).reverse().toString('hex').toUpperCase()

    expect(keyId).toBe('89CF3DDB4BA85203')
  })
})
