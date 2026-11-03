#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { bundleDir, targetFromArgs } from './bundle-paths.mjs'

const MIB = 1024 * 1024
const TOP_LIMIT = 40
const BUDGET_RATIO = 1.05
const UNITS = { B: 1, KiB: 1024, MiB: MIB, GiB: 1024 * MIB }

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BASELINE = path.join(ROOT, 'scripts', 'size-baseline.json')
const RUNTIME_ROOT = path.join(os.homedir(), '.unplatform-ai', 'runtime')
const args = process.argv.slice(2)

/** Bytes of a file or directory tree. */
export async function pathSize(target) {
  const stat = await fs.stat(target).catch(() => null)
  if (!stat) return 0
  if (stat.isFile()) return stat.size

  let total = 0
  for (const entry of await fs.readdir(target)) {
    total += await pathSize(path.join(target, entry))
  }
  return total
}

/** First entry under `dir` whose name ends with `suffix`. */
async function findOne(dir, suffix) {
  const entries = await fs.readdir(dir).catch(() => [])
  const match = entries.find((entry) => entry.endsWith(suffix))
  return match ? path.join(dir, match) : null
}

/** Human size in MiB with one decimal. */
export function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(1)} MiB`
}

/** True when the current size is above the baseline plus the budget ratio. */
export function overBudget(current, baseline) {
  return current > Math.floor(baseline * BUDGET_RATIO)
}

/** Immediate packages under node_modules, scopes and the pnpm store expanded. */
export async function topNodeModules(dir, limit = TOP_LIMIT) {
  const entries = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue
    const target = path.join(dir, entry.name)
    if (entry.name === '.pnpm' || entry.name.startsWith('@')) {
      for (const child of await fs.readdir(target, { withFileTypes: true }).catch(() => [])) {
        if (!child.isDirectory()) continue
        const childPath = path.join(target, child.name)
        const name = entry.name === '.pnpm' ? `.pnpm/${child.name}` : `${entry.name}/${child.name}`
        entries.push({ name, bytes: await pathSize(childPath) })
      }
      continue
    }
    entries.push({ name: entry.name, bytes: await pathSize(target) })
  }
  return entries.sort((a, b) => b.bytes - a.bytes).slice(0, limit)
}

/** Uncompressed size from `zstd -l`, zero when the frame stores no size. */
function listedSize(archive) {
  const output = execFileSync('zstd', ['-l', archive], { encoding: 'utf8' })
  const row = output.split('\n').find((line) => /^\s*\d+\s+\d+\s/.test(line))
  if (!row) return 0
  const columns = row.trim().split(/\s+/)
  const value = Number(columns[4])
  const unit = columns[5]
  if (!Number.isFinite(value) || !Object.hasOwn(UNITS, unit)) return 0
  return Math.round(value * UNITS[unit])
}

/** Counts the decompressed stream when `zstd -l` has no size to read. */
function streamedSize(archive) {
  return new Promise((resolve) => {
    const child = spawn('zstd', ['-dc', archive], { stdio: ['ignore', 'pipe', 'ignore'] })
    let bytes = 0
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length
    })
    child.once('close', (code) => {
      resolve(code === 0 ? bytes : 0)
    })
    child.once('error', () => {
      resolve(0)
    })
  })
}

/** Extracted runtime folder size, or the archive size when it has no folder yet. */
async function runtimeSize(params) {
  const { archive, runtimeDir, hasArchive } = params
  const staged = await pathSize(runtimeDir)
  if (staged > 0) return staged
  if (!hasArchive) return 0

  let listed = 0
  try {
    listed = listedSize(archive)
  } catch {
    // A streamed frame has no stored size, so count the decompressed bytes below.
  }
  if (listed > 0) return listed
  return streamedSize(archive)
}

async function readBaseline() {
  return JSON.parse(await fs.readFile(BASELINE, 'utf8'))
}

async function writeBaseline(report) {
  const baseline = {
    version: report.version,
    measured: new Date().toISOString().slice(0, 10),
    appTotal: report.parts.appTotal,
    runtimeTotal: report.parts.runtimeTotal,
    installTotal: report.parts.installTotal,
  }
  await fs.writeFile(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`)
}

export async function collect(params = {}) {
  const { root = ROOT, target, runtimeDir } = params
  const bundle = bundleDir({ root, target })
  const app = await findOne(path.join(bundle, 'macos'), '.app')
  if (!app) throw new Error(`No .app under ${path.relative(root, bundle)}/macos`)

  const macos = path.join(app, 'Contents', 'MacOS')
  const resources = path.join(app, 'Contents', 'Resources')
  const dmg = await findOne(path.join(bundle, 'dmg'), '.dmg')
  const archive = await findOne(path.join(bundle, 'macos'), '.app.tar.gz')
  const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version
  const serverArchive = path.join(resources, 'server.tar.zst')
  const serverDir = path.join(resources, 'server')
  const hasArchive = await fs.stat(serverArchive).then(
    () => true,
    () => false,
  )
  const serverPath = hasArchive ? serverArchive : serverDir
  const appTotal = await pathSize(app)
  const extracted = runtimeDir ?? path.join(RUNTIME_ROOT, version)
  const runtimeTotal = await runtimeSize({
    archive: serverArchive,
    runtimeDir: extracted,
    hasArchive,
  })

  const parts = {
    serverBinary: await pathSize(path.join(macos, 'unplatform-ai-server')),
    shell: await pathSize(path.join(macos, 'unplatform-ai')),
    ffmpeg: await pathSize(path.join(macos, 'ffmpeg')),
    serverResources: await pathSize(serverPath),
    appTotal,
    runtimeTotal,
    installTotal: appTotal + runtimeTotal,
    dmg: dmg ? await pathSize(dmg) : 0,
    appTarGz: archive ? await pathSize(archive) : 0,
  }

  return {
    version,
    app: path.relative(root, app),
    parts,
    top: hasArchive ? [] : await topNodeModules(path.join(serverDir, 'node_modules')),
  }
}

export async function main() {
  if (process.platform !== 'darwin') {
    console.log('[size-report] macOS only, skipped')
    return
  }

  const report = await collect({ target: targetFromArgs(args) })
  const lines = [`unplatform-ai ${report.version} size report`, '']

  const labels = [
    ['serverBinary', 'unplatform-ai-server'],
    ['shell', 'Contents/MacOS/unplatform-ai'],
    ['ffmpeg', 'ffmpeg'],
    ['serverResources', 'Resources/server.tar.zst'],
    ['appTotal', 'app total'],
    ['runtimeTotal', 'runtime extracted'],
    ['installTotal', 'install total'],
    ['dmg', 'DMG'],
    ['appTarGz', '.app.tar.gz'],
  ]
  for (const [key, label] of labels) {
    const bytes = report.parts[key]
    lines.push(`${label.padEnd(28)} ${bytes ? formatMiB(bytes) : 'n/a'}`)
  }

  lines.push('', `top ${TOP_LIMIT} node_modules entries`)
  for (const entry of report.top) {
    lines.push(`${entry.name.padEnd(48)} ${formatMiB(entry.bytes)}`)
  }

  if (args.includes('--write-baseline')) {
    await writeBaseline(report)
    lines.push('', `baseline written to ${path.relative(ROOT, BASELINE)}`)
  }

  if (args.includes('--check')) {
    const baseline = await readBaseline()
    const limit = Math.floor(baseline.installTotal * BUDGET_RATIO)
    lines.push(
      '',
      `budget install total ${formatMiB(report.parts.installTotal)}, ` +
        `baseline ${formatMiB(baseline.installTotal)}, limit ${formatMiB(limit)}`,
    )
    if (overBudget(report.parts.installTotal, baseline.installTotal)) {
      lines.push(`over budget by ${formatMiB(report.parts.installTotal - limit)}`)
    } else {
      lines.push('within budget')
    }
  }

  const text = `${lines.join('\n')}\n`
  process.stdout.write(text)

  const outIndex = args.indexOf('--out')
  if (outIndex !== -1) {
    await fs.writeFile(args[outIndex + 1], text)
  }

  if (args.includes('--check')) {
    const baseline = await readBaseline()
    if (overBudget(report.parts.installTotal, baseline.installTotal)) process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
