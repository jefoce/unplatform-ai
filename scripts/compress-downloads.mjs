#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGzip } from 'node:zlib'

import { bundleDir, targetFromArgs } from './bundle-paths.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)

async function findOne(dir, suffix) {
  const entries = await fs.readdir(dir).catch(() => [])
  const match = entries.find((entry) => entry.endsWith(suffix))
  return match ? path.join(dir, match) : null
}

/** Packs the app bundle with gzip level 9. */
export async function repackArchive(params) {
  const { appDir, appName, archive } = params
  const temp = `${archive}.tmp`
  const tar = spawn('tar', ['-cf', '-', '-C', appDir, appName], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const gzip = createGzip({ level: 9 })
  const closed = new Promise((resolve, reject) => {
    tar.once('close', resolve)
    tar.once('error', reject)
  })

  await pipeline(tar.stdout, gzip, createWriteStream(temp))

  const code = await closed
  if (code !== 0) throw new Error(`tar failed for ${appName} (${code})`)

  await fs.rename(temp, archive)
}

/** Identity of a signed DMG, or null when it has no signature. */
function dmgIdentity(dmg) {
  const result = spawnSync('codesign', ['-dv', '--verbose=2', dmg], { encoding: 'utf8' })
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.status !== 0 || text.includes('code object is not signed')) return null
  if (text.includes('Signature=adhoc')) return '-'
  return text.match(/^Authority=(.+)$/m)?.[1] ?? null
}

/** Re-signs the converted DMG with the identity it had before. */
function signDmg(dmg, identity) {
  const args = ['--force', '--sign', identity]
  if (identity !== '-') args.push('--timestamp')
  args.push(dmg)
  execFileSync('codesign', args, { stdio: 'inherit' })
}

/** Converts the DMG to ULMO and keeps its signature when it had one. */
async function compressDmg(dmg) {
  const identity = dmgIdentity(dmg)
  const temp = path.join(path.dirname(dmg), 'Unplatform AI-ulmo')
  const converted = `${temp}.dmg`

  await fs.rm(converted, { force: true })
  execFileSync('hdiutil', ['convert', dmg, '-format', 'ULMO', '-o', temp, '-ov'], {
    stdio: 'inherit',
  })
  await fs.rename(converted, dmg)
  if (identity) signDmg(dmg, identity)
  console.log(`[compress] DMG ULMO ${path.basename(dmg)}`)
}

export async function main() {
  if (process.platform !== 'darwin') {
    console.log('[compress] macOS only, skipped')
    return
  }

  const bundle = bundleDir({ root: ROOT, target: targetFromArgs(args) })
  const macos = path.join(bundle, 'macos')
  const app = await findOne(macos, '.app')
  if (!app) throw new Error(`No .app under ${path.relative(ROOT, macos)}`)

  const appName = path.basename(app)
  const archive = path.join(macos, `${appName}.tar.gz`)
  await repackArchive({ appDir: macos, appName, archive })
  console.log(`[compress] app archive gzip -9 ${path.basename(archive)}`)

  const signature = `${archive}.sig`
  if (process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
    execFileSync('pnpm', ['exec', 'tauri', 'signer', 'sign', archive], { stdio: 'inherit' })
    console.log('[compress] app archive re-signed')
  } else {
    await fs.rm(signature, { force: true })
  }

  const dmg = await findOne(path.join(bundle, 'dmg'), '.dmg')
  if (dmg) await compressDmg(dmg)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
