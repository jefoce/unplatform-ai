#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MIB = 1024 * 1024

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TAURI_DIR = path.join(ROOT, 'src-tauri')
const BINARIES_DIR = path.join(TAURI_DIR, 'binaries')
const RESOURCES_DIR = path.join(TAURI_DIR, 'resources', 'server')
const BUNDLE_DIR = path.join(TAURI_DIR, 'resources', 'server-archive')
const SERVER_ARCHIVE = path.join(BUNDLE_DIR, 'server.tar.zst')
const SERVER_BUILD_ID = path.join(BUNDLE_DIR, 'server.build-id')
const LICENSES_DIR = path.join(ROOT, 'licenses')
const RESOURCES_LICENSES = path.join(TAURI_DIR, 'resources', 'licenses')
const CACHE_DIR = path.join(os.homedir(), '.cache', 'unplatform-ai-build')
const FFMPEG_CACHE = path.join(CACHE_DIR, 'ffmpeg')
const NODE_CACHE = path.join(CACHE_DIR, 'node')
const VERSIONS_ENV = path.join(ROOT, 'scripts', 'ffmpeg', 'versions.env')
const NODE_VERSIONS_ENV = path.join(ROOT, 'scripts', 'node', 'versions.env')
const VERIFY_SCRIPT = path.join(ROOT, 'scripts', 'ffmpeg', 'verify.sh')
const PREPARED_TARGET = path.join(TAURI_DIR, 'resources', '.prepared-target')
const args = process.argv.slice(2)

/** Reads `--name value` or `--name=value`. */
function flagValue(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function fail(message) {
  throw new Error(message)
}

/** Target triple from `--target`, the Tauri build env, or the Rust host. */
function targetTriple() {
  const requested = flagValue('--target') ?? process.env.TAURI_ENV_TARGET_TRIPLE
  if (requested) return requested
  try {
    const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
    const host = output.split(/\r?\n/).find((line) => line.startsWith('host:'))
    if (!host) fail('rustc -vV did not report a host triple')
    return host.slice('host:'.length).trim()
  } catch (error) {
    if (error.message?.startsWith('rustc -vV')) throw error
    fail('rustc not found. Install Rust with rustup, or pass --target <triple>.')
  }
}

/** Node distribution platform for a Rust target triple. */
function nodePlatform(triple) {
  const [arch, , system] = triple.split('-')
  const nodeArch = { aarch64: 'arm64', x86_64: 'x64' }[arch]
  if (!nodeArch) fail(`Unsupported CPU architecture in target ${triple}`)
  if (system === 'darwin') return { name: `darwin-${nodeArch}`, windows: false }
  if (system === 'linux') return { name: `linux-${nodeArch}`, windows: false }
  if (system === 'windows') return { name: `win-${nodeArch}`, windows: true }
  fail(`Unsupported target ${triple}. Supported: macOS, Linux, Windows.`)
}

/** Downloads a file unless a cached copy already exists. */
async function cachedDownload(url, target) {
  try {
    return await fs.readFile(target)
  } catch {
    let response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    } catch (error) {
      fail(`Download failed for ${url}: ${error.cause?.message ?? error.message}`)
    }
    if (!response.ok) fail(`Download failed (${response.status}) for ${url}`)
    const body = Buffer.from(await response.arrayBuffer())
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, body)
    return body
  }
}

/** Reads the pinned Node version from scripts/node/versions.env. */
async function nodeVersion() {
  const text = await fs.readFile(NODE_VERSIONS_ENV, 'utf8')
  const match = text.match(/^NODE_VERSION=(\S+)/m)
  if (!match) fail('Could not read NODE_VERSION from scripts/node/versions.env')
  return match[1]
}

/** Custom Node from NODE_BINARY or the small-icu cache. */
async function customNode(platform, triple, version) {
  const explicit = process.env.NODE_BINARY?.trim()
  if (explicit) return { path: path.resolve(explicit), origin: 'NODE_BINARY' }

  const cached = path.join(
    NODE_CACHE,
    `${version}-small-icu`,
    triple,
    `unplatform-ai-server-${triple}${platform.windows ? '.exe' : ''}`,
  )
  const exists = await fs.access(cached).then(
    () => true,
    () => false,
  )
  return exists ? { path: cached, origin: 'cache' } : null
}

/** NODE_BINARY wins, then the custom cache, then the official download. */
async function nodeBinary(platform, triple, version) {
  if (
    process.env.CI &&
    !process.env.NODE_BINARY?.trim() &&
    process.env.ALLOW_OFFICIAL_NODE !== '1'
  ) {
    fail(
      'CI requires NODE_BINARY. Download the built Node artifact and set it before pnpm desktop:prepare, ' +
        'or set ALLOW_OFFICIAL_NODE=1 to use the official binary.',
    )
  }

  const custom = await customNode(platform, triple, version)
  if (custom) return custom

  console.warn(
    `[prepare-desktop] WARNING: no custom Node build found, using official Node v${version}. ` +
      'Run pnpm node:build to build the small-ICU binary.',
  )
  return { path: await ensureNode(platform, version), origin: 'official' }
}

/** Downloads and verifies the pinned official Node binary, returning its cache path. */
async function ensureNode(platform, version) {
  const extension = platform.windows ? 'zip' : 'tar.gz'
  const archiveName = `node-v${version}-${platform.name}.${extension}`
  const archivePath = path.join(CACHE_DIR, archiveName)
  const binaryName = platform.windows ? 'node.exe' : 'node'
  const binaryPath = path.join(
    CACHE_DIR,
    `node-v${version}-${platform.name}${platform.windows ? '.exe' : ''}`,
  )

  try {
    return await fs.access(binaryPath).then(() => binaryPath)
  } catch {
    // Not cached yet.
  }

  const base = `https://nodejs.org/dist/v${version}`
  await cachedDownload(`${base}/${archiveName}`, archivePath)
  const sums = (
    await cachedDownload(
      `${base}/SHASUMS256.txt`,
      path.join(CACHE_DIR, `SHASUMS256-v${version}.txt`),
    )
  ).toString('utf8')
  const line = sums.split(/\r?\n/).find((entry) => entry.endsWith(`  ${archiveName}`))
  if (!line) fail(`No checksum for ${archiveName} in SHASUMS256.txt`)
  const expected = line.split(/\s+/)[0]
  const actual = createHash('sha256')
    .update(await fs.readFile(archivePath))
    .digest('hex')
  if (actual !== expected)
    fail(`Checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}`)

  const extractDir = await fs.mkdtemp(path.join(CACHE_DIR, 'extract-'))
  try {
    execFileSync('tar', ['-xf', archivePath, '-C', extractDir], { stdio: 'inherit' })
    const extracted = await findFile(extractDir, binaryName)
    if (!extracted) fail(`Could not find ${binaryName} in ${archiveName}`)
    await fs.copyFile(extracted, binaryPath)
    await fs.chmod(binaryPath, 0o755)
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true })
  }
  return binaryPath
}

/** First file with the given name anywhere under `dir`. */
async function findFile(dir, name) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === name) return target
    if (entry.isDirectory()) {
      const found = await findFile(target, name)
      if (found) return found
    }
  }
  return null
}

async function pathSize(target) {
  const stat = await fs.stat(target)
  if (stat.isFile()) return stat.size
  let total = 0
  for (const entry of await fs.readdir(target)) {
    total += await pathSize(path.join(target, entry))
  }
  return total
}

function describeSize(bytes) {
  return `${(bytes / MIB).toFixed(1)} MB`
}

async function copyServerResources() {
  const standalone = path.join(ROOT, '.next', 'standalone')
  try {
    await fs.access(path.join(standalone, 'server.js'))
  } catch {
    fail('Missing .next/standalone. Run pnpm build first.')
  }

  const excluded = new Set([
    '.cache',
    '.git',
    '.idea',
    '.vscode',
    '.vitest',
    'data',
    'docs',
    'downloads',
    'scripts',
    'src',
    'src-tauri',
    'tests',
    'uploads',
  ])

  /** Keeps traced dev files and env secrets out of the bundled server. */
  function include(source) {
    const base = path.basename(source)
    if (base.startsWith('.env')) return false
    const [top] = path.relative(standalone, source).split(path.sep)
    if (excluded.has(top)) return false
    return !(top.endsWith('.md') || top === 'project.txt' || top.endsWith('.tsbuildinfo'))
  }

  await fs.rm(RESOURCES_DIR, { recursive: true, force: true })
  await fs.mkdir(RESOURCES_DIR, { recursive: true })
  await fs.cp(standalone, RESOURCES_DIR, { recursive: true, dereference: true, filter: include })
  await fs.cp(path.join(ROOT, '.next', 'static'), path.join(RESOURCES_DIR, '.next', 'static'), {
    recursive: true,
    dereference: true,
  })

  const publicDir = path.join(ROOT, 'public')
  try {
    await fs.access(publicDir)
    await fs.cp(publicDir, path.join(RESOURCES_DIR, 'public'), {
      recursive: true,
      dereference: true,
    })
  } catch {
    // No public directory in this project.
  }
}

/** Stages the bundled runtime license texts for the Tauri resources mapping. */
async function copyLicenses() {
  await fs.rm(RESOURCES_LICENSES, { recursive: true, force: true })
  await fs.cp(LICENSES_DIR, RESOURCES_LICENSES, { recursive: true })
  console.log('[prepare-desktop] licenses copied')
}

/** Package names listed in next.config.ts serverExternalPackages. */
async function externalPackages() {
  const config = await fs.readFile(path.join(ROOT, 'next.config.ts'), 'utf8')
  const match = config.match(/serverExternalPackages:\s*\[([^\]]*)\]/)
  if (!match) fail('Could not read serverExternalPackages from next.config.ts')
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((entry) => entry[1])
}

/** Native platform packages the server loads for this target. */
function nativePackages(platform) {
  const [system, arch] = platform.name.split('-')
  if (system === 'darwin') return [`@img/sharp-darwin-${arch}`, `@napi-rs/keyring-darwin-${arch}`]
  if (system === 'linux') return [`@img/sharp-linux-${arch}`, `@napi-rs/keyring-linux-${arch}-gnu`]
  // ponytail: musl and win32-arm64 builds need their own package names here.
  return [`@img/sharp-win32-${arch}`, `@napi-rs/keyring-win32-${arch}-msvc`]
}

/** Next traces the sharp .node file but not the DLLs beside it, copy the whole native package. */
async function copyNativePackages(platform) {
  for (const name of nativePackages(platform)) {
    const source = path.join(ROOT, 'node_modules', name)
    const target = path.join(RESOURCES_DIR, 'node_modules', name)
    const exists = await fs.access(source).then(
      () => true,
      () => false,
    )

    if (!exists) continue

    await fs.rm(target, { recursive: true, force: true })
    await fs.cp(source, target, { recursive: true, dereference: true })
  }
}

const MACHO_MAGIC = new Set([
  0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca,
])

/** True when the first four bytes are a Mach-O magic. */
async function isMachO(file) {
  const handle = await fs.open(file, 'r')

  try {
    const head = Buffer.alloc(4)
    const { bytesRead } = await handle.read(head, 0, 4, 0)

    if (bytesRead < 4) return false

    return MACHO_MAGIC.has(head.readUInt32BE(0))
  } finally {
    await handle.close()
  }
}

/** Ad-hoc signs every Mach-O under the staged server, matching tauri signingIdentity "-". */
async function signMachOFiles(platform) {
  if (!platform.name.startsWith('darwin')) return

  let count = 0

  for await (const entry of await fs.readdir(RESOURCES_DIR, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue

    const file = path.join(entry.parentPath ?? entry.path, entry.name)

    if (!(await isMachO(file))) continue

    execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'pipe' })
    count++
  }

  console.log(`[prepare-desktop] signed ${count} Mach-O file(s)`)
}

/** Resolves the exit code of a spawned process. */
function exitCode(child) {
  return new Promise((resolve, reject) => {
    child.once('close', resolve)
    child.once('error', reject)
  })
}

/** Packs the staged server as a zstd tar archive and writes its build id. */
async function packServer() {
  const temp = `${SERVER_ARCHIVE}.tmp`
  await fs.mkdir(BUNDLE_DIR, { recursive: true })
  const tar = spawn('tar', ['-cf', '-', '-C', RESOURCES_DIR, '.'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    // macOS tar otherwise writes an AppleDouble `._` file for every entry.
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  })
  const zstd = spawn('zstd', ['-19', '-T0', '-q', '-f', '-o', temp], {
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  const tarDone = exitCode(tar)
  const zstdDone = exitCode(zstd)

  try {
    await pipeline(tar.stdout, zstd.stdin)
    const [tarCode, zstdCode] = await Promise.all([tarDone, zstdDone])
    if (tarCode !== 0) fail(`tar exited with ${tarCode} while packing the server`)
    if (zstdCode !== 0) fail(`zstd exited with ${zstdCode} while packing the server`)
    await fs.rename(temp, SERVER_ARCHIVE)
  } catch (error) {
    await Promise.allSettled([tarDone, zstdDone])
    await fs.rm(temp, { force: true })
    throw error
  }

  const buildId = await fs
    .readFile(path.join(RESOURCES_DIR, '.next', 'BUILD_ID'), 'utf8')
    .then((text) => text.trim())
    .catch(() => '')
  if (!buildId) fail('Missing .next/BUILD_ID in the staged server')
  await fs.writeFile(SERVER_BUILD_ID, `${buildId}\n`)

  const { size } = await fs.stat(SERVER_ARCHIVE)
  console.log(
    `[prepare-desktop] packed ${path.basename(SERVER_ARCHIVE)} ${describeSize(size)} (${buildId})`,
  )
  return size
}

/** Extracts the archive and checks every signed native file on macOS. */
async function verifyPackedServer(platform) {
  if (!platform.name.startsWith('darwin')) return

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unplatform-ai-server-'))

  try {
    execFileSync('tar', ['--zstd', '-xf', SERVER_ARCHIVE, '-C', dir], { stdio: 'inherit' })

    let count = 0

    for await (const entry of await fs.readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.node') && !entry.name.endsWith('.dylib')) continue
      const file = path.join(entry.parentPath ?? entry.path, entry.name)

      execFileSync('codesign', ['-v', file], { stdio: 'pipe' })
      count++
    }

    console.log(`[prepare-desktop] verified ${count} signed native file(s) after extraction`)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

/** Fails with the exact module that cannot resolve from the staged tree. */
async function checkNative(serverBinary, platform) {
  const externals = await externalPackages()
  const native = nativePackages(platform)
  const script = `
    const fs = require('fs')
    const path = require('path')
    const failures = []
    for (const name of ${JSON.stringify(externals)}) {
      try { require(name) } catch (error) {
        failures.push(name + ': ' + error.message.split('\\n')[0])
      }
    }
    for (const name of ${JSON.stringify(native)}) {
      const file = path.join(process.cwd(), 'node_modules', name, 'package.json')
      if (!fs.existsSync(file)) failures.push(name + ': not hoisted')
    }
    if (failures.length) {
      console.error(failures.join('\\n'))
      process.exit(1)
    }
  `
  const env = { ...process.env }
  delete env.NODE_PATH
  try {
    execFileSync(serverBinary, ['-e', script], {
      cwd: RESOURCES_DIR,
      env,
      stdio: 'pipe',
      encoding: 'utf8',
    })
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    fail(`Native modules did not resolve from the staged tree.\n${output}`)
  }
  console.log('[prepare-desktop] native modules resolve')
}

/** First directory whose name matches anywhere under `dir`. */
async function findDir(dir, match) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const target = path.join(dir, entry.name)
    if (match(entry.name)) return target
    const found = await findDir(target, match)
    if (found) return found
  }
  return null
}

/** Removes the GPL-3 ffmpeg-static package. Desktop uses the separate sidecar instead. */
async function pruneFfmpegStatic() {
  const dirs = [path.join(RESOURCES_DIR, 'node_modules', 'ffmpeg-static')]
  const pnpm = path.join(RESOURCES_DIR, 'node_modules', '.pnpm')
  for (const name of await fs.readdir(pnpm).catch(() => [])) {
    if (name.startsWith('ffmpeg-static')) dirs.push(path.join(pnpm, name))
  }
  const traced = path.join(RESOURCES_DIR, '.next', 'node_modules')
  for (const name of await fs.readdir(traced).catch(() => [])) {
    if (name.startsWith('ffmpeg-static')) dirs.push(path.join(traced, name))
  }
  for (const dir of dirs) await fs.rm(dir, { recursive: true, force: true })

  const leftover = await findDir(RESOURCES_DIR, (name) => name.startsWith('ffmpeg-static'))
  if (leftover) fail(`ffmpeg-static still present in the staged server: ${leftover}`)
  console.log('[prepare-desktop] ffmpeg-static package removed')
}

/** Recursively deletes matching files, accumulating count and bytes removed. */
async function pruneMatching(dir, match, removed = { count: 0, bytes: 0 }) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await pruneMatching(target, match, removed)
      continue
    }
    if (!match(entry.name)) continue
    removed.bytes += (await fs.stat(target)).size
    removed.count += 1
    await fs.rm(target, { force: true })
  }
  return removed
}

/** Removes named directories such as test and __tests__. */
async function pruneDirs(dir, match, removed = { count: 0, bytes: 0 }) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const target = path.join(dir, entry.name)
    if (!match(entry.name)) {
      await pruneDirs(target, match, removed)
      continue
    }
    removed.bytes += await pathSize(target)
    removed.count += 1
    await fs.rm(target, { recursive: true, force: true })
  }
  return removed
}

/** Prints one prune group so the log shows where the bytes came from. */
async function pruneGroup(label, match) {
  const removed = await pruneMatching(RESOURCES_DIR, match)
  if (removed.count) {
    console.log(
      `[prepare-desktop] pruned ${label}: ${removed.count} files, ${describeSize(removed.bytes)}`,
    )
  }
  return removed
}

async function pruneOptionalDir(label, target) {
  const exists = await fs.access(target).then(
    () => true,
    () => false,
  )
  if (!exists) return { count: 0, bytes: 0 }
  const bytes = await pathSize(target)
  await fs.rm(target, { recursive: true, force: true })
  console.log(`[prepare-desktop] pruned ${label}: ${describeSize(bytes)}`)
  return { count: 1, bytes }
}

async function pruneOptionalFile(label, target) {
  const stat = await fs.stat(target).catch(() => null)
  if (!stat?.isFile()) return { count: 0, bytes: 0 }
  await fs.rm(target, { force: true })
  console.log(`[prepare-desktop] pruned ${label}: ${describeSize(stat.size)}`)
  return { count: 1, bytes: stat.size }
}

/** Removes native packages for other platforms if tracing pulled them in. */
async function pruneOtherPlatforms(platform) {
  const keep = new Set(
    [...nativePackages(platform), `@img/sharp-libvips-${platform.name}`].map((name) => {
      return name.split('/')[1]
    }),
  )
  const removed = { count: 0, bytes: 0 }

  for (const scope of ['@img', '@napi-rs']) {
    const dir = path.join(RESOURCES_DIR, 'node_modules', scope)
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      if (!/^(sharp|keyring)-/.test(entry.name) || keep.has(entry.name)) continue
      const target = path.join(dir, entry.name)
      removed.bytes += await pathSize(target)
      removed.count += 1
      await fs.rm(target, { recursive: true, force: true })
    }
  }

  if (removed.count) {
    console.log(
      `[prepare-desktop] pruned other platforms: ${removed.count} packages, ${describeSize(removed.bytes)}`,
    )
  }
  return removed
}

const LICENSE_DOC = /^(?:license|licence|notice|copying|copyright|authors)\b/i

const RUNTIME_ROOT = new Set([
  '.next',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'node_modules',
  'package.json',
  'public',
  'server.js',
])

/** Deletes root entries the runtime never reads: configs, lockfiles, CI and editor dirs. */
async function pruneRuntimeRoot(dir, removed = { count: 0, bytes: 0 }) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (RUNTIME_ROOT.has(entry.name)) continue
    const target = path.join(dir, entry.name)
    removed.bytes += await pathSize(target)
    removed.count += 1
    await fs.rm(target, { recursive: true, force: true })
  }
  return removed
}

/** Reads the pinned ffmpeg version from scripts/ffmpeg/versions.env. */
async function ffmpegVersion() {
  const text = await fs.readFile(VERSIONS_ENV, 'utf8')
  const match = text.match(/^FFMPEG_VERSION=(\S+)/m)
  if (!match) fail('Could not read FFMPEG_VERSION from scripts/ffmpeg/versions.env')
  return match[1]
}

/** License flags reported by `ffmpeg -buildconf`. */
function licenseFlags(buildconf) {
  const flags = ['gpl', 'version3', 'nonfree'].filter((name) =>
    buildconf.includes(`--enable-${name}`),
  )
  return flags.length ? flags.join(', ') : 'none'
}

/** Custom binary from FFMPEG_BINARY or the version/profile cache. */
async function customFfmpeg(platform, triple) {
  const explicit = process.env.FFMPEG_BINARY?.trim()
  if (explicit) return { path: path.resolve(explicit), origin: 'FFMPEG_BINARY' }

  const profile = process.env.FFMPEG_PROFILE?.trim() || 'minimal'
  const version = await ffmpegVersion()
  const extension = platform.windows ? '.exe' : ''
  const cached = path.join(
    FFMPEG_CACHE,
    `${version}-${profile}`,
    triple,
    `ffmpeg-${triple}${extension}`,
  )
  const exists = await fs.access(cached).then(
    () => true,
    () => false,
  )
  return exists ? { path: cached, origin: 'cache' } : null
}

/** Runs scripts/ffmpeg/verify.sh against a custom build. */
function verifyCustomFfmpeg(binary) {
  try {
    execFileSync('bash', [VERIFY_SCRIPT, binary], { stdio: 'inherit' })
  } catch (error) {
    fail(`ffmpeg verification failed for ${binary}: ${error.message}`)
  }
}

/** Reads license flags and blocks nonfree builds unless explicitly local. */
function verifyFfmpeg(binary, allowNonfree) {
  let buildconf
  try {
    buildconf = execFileSync(binary, ['-hide_banner', '-buildconf'], { encoding: 'utf8' })
  } catch (error) {
    fail(`Could not read ffmpeg build flags from ${binary}: ${error.message}`)
  }
  if (!buildconf.includes('--enable-nonfree')) return licenseFlags(buildconf)

  if (allowNonfree && process.env.ALLOW_NONFREE_FFMPEG === '1' && !process.env.CI) {
    console.warn(
      '[prepare-desktop] WARNING: ffmpeg has --enable-nonfree. Local build only, do not ship.',
    )
    return licenseFlags(buildconf)
  }
  fail(
    'Bundled ffmpeg is built with --enable-nonfree and cannot be redistributed. ' +
      'Set FFMPEG_BINARY or run pnpm ffmpeg:build, or set ALLOW_NONFREE_FFMPEG=1 for a local-only build.',
  )
}

/** Ad-hoc signs a staged sidecar in place. */
function signSidecar(target) {
  execFileSync('codesign', ['--force', '--sign', '-', target], { stdio: 'pipe' })
  console.log(`[prepare-desktop] sidecar signed ${path.basename(target)}`)
}

/**
 * Copies a sidecar through a temp file so the target gets a fresh inode,
 * then signs it on macOS and runs the optional verify step.
 */
async function stageSidecar(params) {
  const { source, target, platform, sign = signSidecar, verify } = params
  const temp = `${target}.tmp-${process.pid}`

  await fs.copyFile(source, temp)

  try {
    await fs.chmod(temp, 0o755)
    await fs.rename(temp, target)

    if (platform.name.startsWith('darwin')) await sign(target)

    if (verify) return verify(target)

    return target
  } finally {
    await fs.rm(temp, { force: true })
  }
}

/** Copies the custom or ffmpeg-static fallback binary into the sidecar slot. */
async function copyFfmpeg(platform, triple) {
  if (process.env.CI && !process.env.FFMPEG_BINARY?.trim()) {
    fail(
      'CI requires FFMPEG_BINARY. Download the built ffmpeg artifact and set it before pnpm desktop:prepare.',
    )
  }

  const custom = await customFfmpeg(platform, triple)
  if (!custom && process.env.ALLOW_NONFREE_FFMPEG !== '1') {
    fail(
      'No redistributable ffmpeg found. Set FFMPEG_BINARY, run pnpm ffmpeg:build, ' +
        'or set ALLOW_NONFREE_FFMPEG=1 for a local-only ffmpeg-static build.',
    )
  }

  const source =
    custom?.path ??
    path.join(ROOT, 'node_modules', 'ffmpeg-static', platform.windows ? 'ffmpeg.exe' : 'ffmpeg')
  try {
    await fs.access(source)
  } catch {
    fail(`Missing ffmpeg binary: ${source}`)
  }
  const target = path.join(BINARIES_DIR, `ffmpeg-${triple}${platform.windows ? '.exe' : ''}`)
  const license = await stageSidecar({
    source,
    target,
    platform,
    verify: (staged) => verifyFfmpeg(staged, !custom),
  })
  if (custom) verifyCustomFfmpeg(target)
  return {
    target,
    source,
    custom: Boolean(custom),
    origin: custom?.origin ?? 'ffmpeg-static',
    license,
  }
}

/** True when the release workflow already staged this exact target. */
async function preparedTarget(triple, serverBinary, platform) {
  if (process.env.UPAI_PREPARED?.trim() !== '1') return false
  const marker = await fs.readFile(PREPARED_TARGET, 'utf8').catch(() => '')
  if (marker.trim() !== triple) return false

  const ffmpeg = path.join(BINARIES_DIR, `ffmpeg-${triple}${platform.windows ? '.exe' : ''}`)
  const files = [
    serverBinary,
    ffmpeg,
    path.join(RESOURCES_DIR, 'server.js'),
    SERVER_ARCHIVE,
    SERVER_BUILD_ID,
  ]
  for (const file of files) {
    const exists = await fs.access(file).then(
      () => true,
      () => false,
    )
    if (!exists) return false
  }
  return true
}

async function main() {
  const triple = targetTriple()
  const platform = nodePlatform(triple)
  const serverBinary = path.join(
    BINARIES_DIR,
    `unplatform-ai-server-${triple}${platform.windows ? '.exe' : ''}`,
  )

  const ffmpegTarget = path.join(BINARIES_DIR, `ffmpeg-${triple}${platform.windows ? '.exe' : ''}`)
  if (await preparedTarget(triple, serverBinary, platform).catch(() => false)) {
    const license = verifyFfmpeg(ffmpegTarget, false)
    console.log(
      `[prepare-desktop] UPAI_PREPARED=1 and ${triple} is already staged, skipping (licenses ${license})`,
    )
    return
  }

  await fs.mkdir(BINARIES_DIR, { recursive: true })
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.rm(PREPARED_TARGET, { force: true })

  console.log(`[prepare-desktop] target ${triple}`)
  await copyServerResources()
  await copyNativePackages(platform)
  await signMachOFiles(platform)
  await copyLicenses()
  await pruneFfmpegStatic()

  const removed = { count: 0, bytes: 0 }
  const groups = [
    ['source maps', (name) => name.endsWith('.map')],
    ['type declarations', (name) => /\.d\.[cm]?ts$/.test(name)],
    ['docs', (name) => name.endsWith('.md') && !LICENSE_DOC.test(name)],
    ['build traces', (name) => name.endsWith('.nft.json') || name === '.DS_Store'],
    ['build metadata', (name) => name.endsWith('.tsbuildinfo')],
  ]
  for (const [label, match] of groups) {
    const group = await pruneGroup(label, match)
    removed.count += group.count
    removed.bytes += group.bytes
  }

  // Scope to dependency trees, route handlers such as app/api/settings/test/route.js must survive.
  const depRoots = [
    path.join(RESOURCES_DIR, 'node_modules'),
    path.join(RESOURCES_DIR, '.next', 'node_modules'),
  ]
  const testDirs = { count: 0, bytes: 0 }
  for (const root of depRoots) {
    const isPresent = await fs.access(root).then(
      () => true,
      () => false,
    )
    if (!isPresent) continue
    const pruned = await pruneDirs(
      root,
      (name) =>
        name === 'test' ||
        name === 'tests' ||
        name === '__tests__' ||
        name === 'docs' ||
        name === 'examples' ||
        name === 'benchmark' ||
        name === 'benchmarks',
    )
    testDirs.count += pruned.count
    testDirs.bytes += pruned.bytes
  }
  if (testDirs.count) {
    console.log(
      `[prepare-desktop] pruned test directories: ${testDirs.count} dirs, ${describeSize(testDirs.bytes)}`,
    )
  }
  removed.count += testDirs.count
  removed.bytes += testDirs.bytes

  const unusedNext = [
    [
      'unused @vercel/og image code',
      path.join('node_modules', 'next', 'dist', 'compiled', '@vercel', 'og'),
    ],
    ['unused edge runtime', path.join('node_modules', 'next', 'dist', 'compiled', 'edge-runtime')],
    ['unused MSW test code', path.join('node_modules', 'next', 'dist', 'compiled', '@mswjs')],
    ['unused tar build code', path.join('node_modules', 'next', 'dist', 'compiled', 'tar')],
    [
      'unused experimental runtime',
      path.join(
        'node_modules',
        'next',
        'dist',
        'compiled',
        'next-server',
        'app-page-turbo-experimental.runtime.prod.js',
      ),
    ],
  ]
  for (const [label, relative] of unusedNext) {
    const target = path.join(RESOURCES_DIR, relative)
    const pruned = relative.endsWith('.js')
      ? await pruneOptionalFile(label, target)
      : await pruneOptionalDir(label, target)
    removed.count += pruned.count
    removed.bytes += pruned.bytes
  }

  const otherPlatforms = await pruneOtherPlatforms(platform)
  removed.count += otherPlatforms.count
  removed.bytes += otherPlatforms.bytes

  await pruneRuntimeRoot(RESOURCES_DIR, removed)
  console.log(
    `[prepare-desktop] server resources copied (${removed.count} files removed, ${describeSize(removed.bytes)})`,
  )

  const version = await nodeVersion()
  const node = await nodeBinary(platform, triple, version)
  await stageSidecar({ source: node.path, target: serverBinary, platform })
  console.log(`[prepare-desktop] node ${version} ${node.origin} copied`)

  const ffmpeg = await copyFfmpeg(platform, triple)
  const license = ffmpeg.license
  const ffmpegSize = await pathSize(ffmpeg.target)
  console.log(
    `[prepare-desktop] ffmpeg ${ffmpeg.origin} ${ffmpeg.source} (${describeSize(ffmpegSize)}, licenses ${license})`,
  )

  await checkNative(serverBinary, platform)
  const archiveSize = await packServer()
  await verifyPackedServer(platform)

  await fs.mkdir(path.dirname(PREPARED_TARGET), { recursive: true })
  await fs.writeFile(PREPARED_TARGET, `${triple}\n`)

  const [resources, nodeSize] = await Promise.all([pathSize(RESOURCES_DIR), pathSize(serverBinary)])
  console.log(
    `[prepare-desktop] server ${describeSize(resources)}, archive ${describeSize(archiveSize)}, node ${describeSize(nodeSize)}, ffmpeg ${describeSize(ffmpegSize)}`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (error) {
    console.error(`[prepare-desktop] ${error.message}`)
    process.exit(1)
  }
}

export { stageSidecar }
