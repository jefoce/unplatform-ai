#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { z } from 'zod'

const FALLBACK_NOTES = 'See CHANGELOG.md'
const DEFAULT_REPO = 'jefoce/unplatform-ai'

const HttpsUrlSchema = z.url().refine((value) => value.startsWith('https://'), {
  message: 'URL must use https',
})

const PlatformEntrySchema = z.object({
  signature: z.string().min(1),
  url: HttpsUrlSchema,
})

export const ManifestSchema = z.object({
  version: z.string().min(1),
  notes: z.string(),
  pub_date: z.string().min(1),
  platforms: z.object({
    'darwin-aarch64': PlatformEntrySchema,
    'windows-x86_64': PlatformEntrySchema,
    'linux-x86_64': PlatformEntrySchema,
  }),
})

/**
 * Returns the `## <version>` section body from a changelog, or null.
 */
function findNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => {
    return line === `## ${version}` || line.startsWith(`## ${version} `)
  })

  if (start === -1) {
    return null
  }

  const after = lines.slice(start + 1)
  const end = after.findIndex((line) => {
    return line.startsWith('## ')
  })
  const body = (end === -1 ? after : after.slice(0, end)).join('\n').trim()

  if (body === '') {
    return null
  }

  return body
}

/**
 * Returns the notes of a version, then of its base version (`0.2.0-rc.1` -> `0.2.0`).
 */
export function extractNotes(changelog, version) {
  const base = version.split(/[-+]/)[0]

  return findNotes(changelog, version) ?? findNotes(changelog, base) ?? FALLBACK_NOTES
}

/**
 * Derives the three release asset names for a version.
 */
export function assetNames(version) {
  return {
    darwinAarch64: `unplatform-ai-${version}-macos-arm64.app.tar.gz`,
    windowsX8664: `unplatform-ai-${version}-windows-x64-setup.exe`,
    linuxX8664: `unplatform-ai-${version}-linux-x64.AppImage`,
  }
}

/**
 * Builds and validates the updater manifest.
 */
export function buildManifest(params) {
  const { version, changelog, notes, pubDate, tag, assets, signatures } = params
  const repo = params.repo ?? DEFAULT_REPO
  const base = `https://github.com/${repo}/releases/download/${tag}`

  return ManifestSchema.parse({
    version,
    notes: notes ?? extractNotes(changelog, version),
    pub_date: pubDate,
    platforms: {
      'darwin-aarch64': {
        signature: signatures.darwinAarch64,
        url: `${base}/${assets.darwinAarch64}`,
      },
      'windows-x86_64': {
        signature: signatures.windowsX8664,
        url: `${base}/${assets.windowsX8664}`,
      },
      'linux-x86_64': {
        signature: signatures.linuxX8664,
        url: `${base}/${assets.linuxX8664}`,
      },
    },
  })
}

function readSignature(dir, asset) {
  return readFileSync(path.join(dir, `${asset}.sig`), 'utf8').trim()
}

function main() {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      tag: { type: 'string' },
      changelog: { type: 'string', default: 'CHANGELOG.md' },
      'pub-date': { type: 'string' },
      signatures: { type: 'string' },
      out: { type: 'string', default: 'latest.json' },
      repo: { type: 'string', default: DEFAULT_REPO },
    },
  })
  const { version, tag, changelog, signatures, out, repo } = values
  const pubDate = values['pub-date']

  if (!version || !tag || !pubDate || !signatures) {
    console.error(
      'usage: updater-manifest.mjs --version V --tag T --pub-date D --signatures DIR [--changelog FILE] [--out FILE] [--repo OWNER/NAME]',
    )
    process.exit(2)
  }

  const assets = assetNames(version)
  const manifest = buildManifest({
    version,
    changelog: readFileSync(changelog, 'utf8'),
    pubDate,
    tag,
    repo,
    assets,
    signatures: {
      darwinAarch64: readSignature(signatures, assets.darwinAarch64),
      windowsX8664: readSignature(signatures, assets.windowsX8664),
      linuxX8664: readSignature(signatures, assets.linuxX8664),
    },
  })

  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${out}`)
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url)

if (isCli) {
  main()
}
