#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [, , mode, ...args] = process.argv

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

if (mode === 'write') {
  const [binary, out, name, target, version, profile] = args
  const manifest = { name, target, version, sha256: sha256(binary) }

  if (profile) manifest.profile = profile

  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
} else if (mode === 'verify') {
  const [binary, file] = args
  const manifest = JSON.parse(readFileSync(file, 'utf8'))

  if (manifest.sha256 !== sha256(binary)) {
    console.error('sidecar sha256 mismatch')
    process.exit(1)
  }
} else {
  console.error(
    'usage: sidecar-manifest.mjs write <binary> <out> <name> <target> <version> [profile] | verify <binary> <manifest>',
  )
  process.exit(2)
}
