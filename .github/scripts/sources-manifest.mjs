#!/usr/bin/env node
// Writes ffmpeg-sources-manifest.json with the sha256 of every file in a directory.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [, , dir, tag] = process.argv

if (!dir || !tag) {
  console.error('usage: sources-manifest.mjs <dir> <tag>')
  process.exit(2)
}

const files = {}

for (const name of readdirSync(dir).sort()) {
  files[name] = createHash('sha256')
    .update(readFileSync(path.join(dir, name)))
    .digest('hex')
}

writeFileSync(
  path.join(dir, 'ffmpeg-sources-manifest.json'),
  `${JSON.stringify({ tag, files }, null, 2)}\n`,
)
