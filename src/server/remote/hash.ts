import 'server-only'

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'

export interface FileHash {
  sha256Hex: string
  sha256Base64: string
  size: number
  mtimeMs: number
}

/** Streams the file once so large videos stay out of memory. */
export async function hashFile(file: string): Promise<FileHash> {
  const stats = await fs.stat(file)
  const hash = createHash('sha256')

  for await (const chunk of createReadStream(file)) hash.update(chunk)

  const digest = hash.digest()

  return {
    sha256Hex: digest.toString('hex'),
    sha256Base64: digest.toString('base64'),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  }
}
