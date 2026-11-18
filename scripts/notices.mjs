#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import sharp from 'sharp'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKAGE = path.join(ROOT, 'package.json')
const NOTICES = path.join(ROOT, 'THIRD_PARTY_NOTICES.md')
const LOCK = path.join(ROOT, 'src-tauri', 'Cargo.lock')
const LICENSE = path.join(ROOT, 'LICENSE')
const LICENSES = path.join(ROOT, 'licenses')
const NPM_LICENSES = path.join(LICENSES, 'npm')
const CARGO_LICENSES = path.join(LICENSES, 'cargo')
const SPDX_LICENSES = path.join(LICENSES, 'spdx')
const LGPL = path.join(LICENSES, 'LICENSE.lgpl3')
const GPL = path.join(LICENSES, 'COPYING.GPLv3')
const LGPL21 = path.join(LICENSES, 'COPYING.LGPLv2.1')
const RESOURCES = path.join(ROOT, 'src-tauri', 'resources')
const FFMPEG_DIR = path.join(ROOT, 'scripts', 'ffmpeg')
const START = '<!-- npm-licenses:start -->'
const END = '<!-- npm-licenses:end -->'
const FFMPEG_START = '<!-- ffmpeg-buildconf:start -->'
const FFMPEG_END = '<!-- ffmpeg-buildconf:end -->'
const LIBVIPS_START = '<!-- libvips-bundle:start -->'
const LIBVIPS_END = '<!-- libvips-bundle:end -->'
const GSTREAMER_START = '<!-- gstreamer-bundle:start -->'
const GSTREAMER_END = '<!-- gstreamer-bundle:end -->'
const SOURCE_START = '<!-- source-offer:start -->'
const SOURCE_END = '<!-- source-offer:end -->'
const GSTREAMER_VERSION = '1.20.3'
const SOURCE_OFFER_URL = 'https://github.com/jefoce/unplatform-ai/issues'
/**
 * Top-level package files that carry license text.
 */
const LICENSE_FILE = /^(?:licen[cs]e|copying|notice|copyright)/i

/** versions.json key to the library name in the sharp-libvips licensing table. */
const LIBVIPS_NAMES = {
  archive: 'libarchive',
  exif: 'libexif',
  ffi: 'libffi',
  heif: 'libheif',
  imagequant: 'libimagequant',
  png: 'libpng',
  rsvg: 'librsvg',
  tiff: 'libtiff',
  uhdr: 'libultrahdr',
  vips: 'libvips',
  webp: 'libwebp',
  xml2: 'libxml2',
}

/** Exact license names normalized to SPDX identifiers. */
const LICENSE_NAMES = {
  LGPLv3: 'LGPL-3.0-or-later',
  'MIT License': 'MIT',
  'Mozilla Public License 1.1': 'MPL-1.1',
  'BSD 2-Clause': 'BSD-2-Clause',
  'BSD 3-Clause': 'BSD-3-Clause',
  'New BSD License': 'BSD-3-Clause',
}

const GSTREAMER_ROWS = [
  [
    'GStreamer',
    GSTREAMER_VERSION,
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gstreamer',
  ],
  [
    'gst-plugins-base',
    GSTREAMER_VERSION,
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-base',
  ],
  [
    'gst-plugins-good',
    GSTREAMER_VERSION,
    'LGPL-2.1-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-good',
  ],
  [
    'gst-plugins-bad',
    GSTREAMER_VERSION,
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-bad',
  ],
  [
    'gst-libav',
    GSTREAMER_VERSION,
    'LGPL-2.1-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-libav',
  ],
]

let npmGroupsCache

/**
 * npm production dependencies grouped by license.
 */
function npmGroups() {
  if (npmGroupsCache) return npmGroupsCache
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
  npmGroupsCache = JSON.parse(raw)
  return npmGroupsCache
}

/**
 * npm production dependency list from pnpm, sorted by license and name.
 */
function npmSection() {
  const groups = npmGroups()
  const lines = ['## npm production dependencies', '']

  for (const license of Object.keys(groups).sort()) {
    lines.push(`### ${license}`, '')
    const packages = [...groups[license]].sort((a, b) => a.name.localeCompare(b.name))
    for (const pkg of packages) {
      lines.push(`- ${pkg.name} ${pkg.versions.join(', ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Normalized license text with one trailing newline.
 */
function normalizeLicense(text) {
  return `${text.replace(/\r\n?/g, '\n').trimEnd()}\n`
}

/**
 * Deterministic file name for one package version.
 */
function licenseFileName(name, version) {
  const base = `${name}-${version}`.replace(/^@/, '').replace(/[/+]/g, '-')
  return `${base}.txt`
}

/**
 * License files shipped at the top of a package directory, sorted by name.
 */
async function licenseFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const names = entries
    .filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  const files = []
  for (const name of names) {
    files.push({ name, text: await fs.readFile(path.join(dir, name), 'utf8') })
  }
  return files
}

/**
 * Real license file texts with one header per source file.
 */
function licenseText(files) {
  return files
    .map((file) => `===== ${file.name} =====\n\n${normalizeLicense(file.text)}`)
    .join('\n')
}

/**
 * License identifiers in an SPDX expression, exceptions dropped.
 */
function licenseIds(expression) {
  const ids = expression
    .replace(/\s+WITH\s+\S+/g, '')
    .split(/\s+(?:OR|AND)\s+|\//)
    .map((id) => id.replace(/[()]/g, '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

/**
 * SPDX text for a package that ships no license file.
 */
async function spdxLicenseText(pkg) {
  const parts = []
  for (const id of licenseIds(pkg.license)) {
    const file = path.join(SPDX_LICENSES, `${id}.txt`)
    const text = await fs.readFile(file, 'utf8').catch(() => {
      throw new Error(`${pkg.name} ${pkg.version} needs licenses/spdx/${id}.txt`)
    })
    parts.push(`===== SPDX ${id} =====\n\n${normalizeLicense(text)}`)
  }
  const header = [
    `${pkg.name} ${pkg.version}`,
    `License: ${pkg.license}`,
    '',
    'The package ships no license file. The text below comes from the SPDX License List.',
  ].join('\n')
  return `${header}\n\n${parts.join('\n')}`
}

/**
 * Committed npm license texts keyed by file name.
 */
async function npmLicenseEntries() {
  const groups = npmGroups()
  const entries = new Map()
  for (const [license, packages] of Object.entries(groups)) {
    for (const pkg of packages) {
      for (const [index, version] of pkg.versions.entries()) {
        const dir = pkg.paths[index] ?? pkg.paths[0]
        const files = await licenseFiles(dir)
        const text =
          files.length > 0
            ? licenseText(files)
            : await spdxLicenseText({ name: pkg.name, version, license })
        entries.set(licenseFileName(pkg.name, version), text)
      }
    }
  }
  return entries
}

/**
 * Registry packages in Cargo.lock, sorted by name and version.
 */
export function cargoPackages(lockText) {
  const packages = []
  for (const block of lockText.split('[[package]]').slice(1)) {
    const name = block.match(/^name = "(.+)"$/m)?.[1]
    const version = block.match(/^version = "(.+)"$/m)?.[1]
    const source = block.match(/^source = "(.+)"$/m)?.[1]
    if (!name || !version || !source?.startsWith('registry+')) continue
    packages.push({ name, version })
  }

  return packages.sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1
    if (a.version !== b.version) return a.version < b.version ? -1 : 1
    return 0
  })
}

/**
 * Registry source directories under CARGO_HOME.
 */
async function cargoRegistryRoots() {
  const home = process.env.CARGO_HOME?.trim() || path.join(os.homedir(), '.cargo')
  const dir = path.join(home, 'registry', 'src')
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name))
}

/**
 * Extracted crate directory in one of the registry roots.
 */
async function crateDir(roots, pkg) {
  for (const root of roots) {
    const dir = path.join(root, `${pkg.name}-${pkg.version}`)
    const stat = await fs.stat(dir).catch(() => null)
    if (stat?.isDirectory()) return dir
  }
  return null
}

/**
 * Package section of a Cargo.toml.
 */
function cargoPackageSection(toml) {
  const start = toml.search(/^\[package\]$/m)
  if (start === -1) return ''
  const rest = toml.slice(start + '[package]'.length)
  const end = rest.search(/^\[/m)
  return end === -1 ? rest : rest.slice(0, end)
}

/**
 * Committed cargo license texts keyed by file name.
 */
async function cargoLicenseEntries() {
  const lock = await fs.readFile(LOCK, 'utf8')
  const roots = await cargoRegistryRoots()
  const entries = new Map()
  const missing = []
  for (const pkg of cargoPackages(lock)) {
    const dir = await crateDir(roots, pkg)
    if (dir === null) {
      missing.push(`${pkg.name} ${pkg.version}`)
      continue
    }

    const toml = await fs.readFile(path.join(dir, 'Cargo.toml'), 'utf8')
    const license = cargoPackageSection(toml).match(/^license\s*=\s*"([^"]+)"/m)?.[1]
    if (!license) throw new Error(`Missing license field for ${pkg.name} ${pkg.version}`)

    const files = await licenseFiles(dir)
    const text = files.length > 0 ? licenseText(files) : await spdxLicenseText({ ...pkg, license })
    entries.set(licenseFileName(pkg.name, pkg.version), text)
  }
  if (missing.length > 0) {
    throw new Error(`Missing cargo registry sources for ${missing[0]}, run cargo fetch`)
  }
  return entries
}

/**
 * Committed texts must match the generated set exactly.
 */
export async function checkLicenseTexts(entries, dir, label) {
  const committed = await fs.readdir(dir).catch(() => [])
  for (const file of [...entries.keys()].sort()) {
    const current = await fs.readFile(path.join(dir, file), 'utf8').catch(() => null)
    if (current === null) throw new Error(`${label}/${file} is missing, run pnpm notices`)
    if (current !== entries.get(file)) {
      throw new Error(`${label}/${file} is stale, run pnpm notices`)
    }
  }
  const extra = committed.filter((file) => !entries.has(file)).sort()
  if (extra.length > 0) throw new Error(`${label}/${extra[0]} is stale, run pnpm notices`)
}

/**
 * npm license texts must match the installed packages.
 */
export async function checkNpmLicenseTexts() {
  await checkLicenseTexts(await npmLicenseEntries(), NPM_LICENSES, 'licenses/npm')
}

/**
 * Cargo license texts must cover every crate in Cargo.lock.
 */
export async function checkCargoLicenseTexts(lockText, dir = CARGO_LICENSES) {
  const expected = cargoPackages(lockText).map((pkg) => {
    return licenseFileName(pkg.name, pkg.version)
  })
  const committed = (await fs.readdir(dir).catch(() => [])).sort()
  for (const file of expected) {
    if (!committed.includes(file)) {
      throw new Error(`licenses/cargo/${file} is missing, run pnpm notices`)
    }
  }
  const extra = committed.filter((file) => !expected.includes(file))
  if (extra.length > 0) throw new Error(`licenses/cargo/${extra[0]} is stale, run pnpm notices`)
  for (const file of committed) {
    const stat = await fs.stat(path.join(dir, file))
    if (stat.size === 0) throw new Error(`licenses/cargo/${file} is empty, run pnpm notices`)
  }
}

/**
 * Replaces a licenses subdirectory with the generated texts.
 */
async function writeLicenseTexts(dir, entries) {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  for (const file of [...entries.keys()].sort()) {
    await fs.writeFile(path.join(dir, file), entries.get(file))
  }
}

/** npm section in the notices must match the one generated from the lockfile. */
export function checkNpmSection(text, section) {
  if (sectionText(text, START, END) !== section.trim()) {
    throw new Error('THIRD_PARTY_NOTICES.md npm section is stale, run pnpm notices')
  }
}

/** App license line must match the package.json license field. */
export function checkAppLicense(text, license) {
  const expected = `Unplatform AI itself is licensed under ${license}. See [LICENSE](LICENSE).`
  const line = text.split(/\r?\n/).find((entry) => {
    return entry.startsWith('Unplatform AI itself')
  })
  if (line !== expected) {
    throw new Error(`THIRD_PARTY_NOTICES.md app license must say "${expected}"`)
  }
}

/** npm section for check mode. A failed read fails the check, never keeps stale text. */
function checkedNpmSection() {
  try {
    return npmSection()
  } catch (error) {
    throw new Error(`pnpm licenses list failed: ${error.message}`, { cause: error })
  }
}

/** Markdown table with columns padded to the widest cell. */
function markdownTable(headers, rows) {
  const widths = headers.map((header, index) => {
    return Math.max(3, header.length, ...rows.map((row) => row[index].length))
  })
  const line = (cells) => {
    return `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`
  }
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`

  return [line(headers), separator, ...rows.map(line)].join('\n')
}

/** Text between two markers, trimmed. */
function sectionText(text, startMark, endMark) {
  const start = text.indexOf(startMark)
  const end = text.indexOf(endMark)
  if (start === -1 || end === -1 || end < start)
    throw new Error(`Missing ${startMark} or ${endMark}`)

  return text.slice(start + startMark.length, end).trim()
}

/** Installed libvips package, its versions and its licensing table. */
export async function libvipsBundle(
  imageDir = path.join(ROOT, 'node_modules', '@img'),
  platform = process.platform,
  arch = process.arch,
) {
  const candidates = [`sharp-libvips-${platform}-${arch}`]
  if (platform === 'win32') candidates.push(`sharp-${platform}-${arch}`)
  const entries = await fs.readdir(imageDir).catch(() => [])
  const name = candidates.find((candidate) => {
    return entries.includes(candidate)
  })
  if (!name) throw new Error(`Missing @img/${candidates.join(' or @img/')} package`)

  const dir = path.join(imageDir, name)
  const versions = JSON.parse(await fs.readFile(path.join(dir, 'versions.json'), 'utf8'))
  const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'))
  const readme = await fs.readFile(path.join(dir, 'README.md'), 'utf8')
  const licenses = new Map()

  for (const line of readme.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => {
      return cell.trim()
    })
    if (cells.length < 4) continue
    const library = cells[1]
    if (!library || library === 'Library' || /^-+$/.test(library)) continue
    licenses.set(library, cells[2])
  }

  return { versions, version: pkg.version, licenses }
}

/** Rows for every library in the sharp-libvips bundle. */
export async function libvipsSection() {
  const { versions, licenses } = await libvipsBundle()
  const source = 'https://github.com/lovell/sharp-libvips#licensing'
  const rows = Object.entries(versions).map(([key, value]) => {
    const name = LIBVIPS_NAMES[key] ?? key
    const license = licenses.get(name)
    if (!license) throw new Error(`Missing ${name} in the sharp-libvips licensing table`)

    return [name, String(value), LICENSE_NAMES[license] ?? license, source]
  })

  return [
    '### libvips libraries',
    '',
    `The bundled libvips ${versions.vips} includes these libraries. Licenses come from the sharp-libvips licensing table.`,
    '',
    markdownTable(['Library', 'Version', 'License', 'Source'], rows),
  ].join('\n')
}

/** LGPL rows for the GStreamer plugins bundled in the Linux AppImage. */
export function gstreamerSection() {
  return [
    '### GStreamer (Linux AppImage)',
    '',
    'The AppImage bundles the GStreamer libraries that WebKitGTK needs to play video. Their license text is in [licenses/COPYING.LGPLv2.1](licenses/COPYING.LGPLv2.1).',
    '',
    markdownTable(['Component', 'Version', 'License', 'Source'], GSTREAMER_ROWS),
  ].join('\n')
}

/**
 * Written offer for the libvips and GStreamer source code.
 */
export async function sourceOfferSection() {
  const { versions } = sharp
  const rows = [
    [
      'libvips',
      versions.vips,
      'LGPL-3.0-or-later',
      `https://github.com/libvips/libvips/archive/refs/tags/v${versions.vips}.tar.gz`,
    ],
    [
      'GStreamer',
      GSTREAMER_VERSION,
      'LGPL-2.0-or-later',
      `https://gstreamer.freedesktop.org/src/gstreamer/gstreamer-${GSTREAMER_VERSION}.tar.xz`,
    ],
  ]

  return [
    '### Source code offer',
    '',
    'The app bundles these libraries under the LGPL. Each source link is the exact version in the installers.',
    '',
    `For three years after you receive a build, we offer the same corresponding source on physical media or by download. Request it at ${SOURCE_OFFER_URL}.`,
    '',
    markdownTable(['Library', 'Version', 'License', 'Source'], rows),
  ].join('\n')
}

/**
 * Every `licenses/<name>` link in the notices must resolve to a file under root.
 */
export async function checkLicenseLinks(text, root = ROOT) {
  const names = [...text.matchAll(/\]\((licenses\/[^)\s]+)\)/g)].map((match) => {
    return match[1]
  })

  for (const name of new Set(names)) {
    await fs.access(path.join(root, name)).catch(() => {
      throw new Error(`THIRD_PARTY_NOTICES.md links missing license file ${name}`)
    })
  }
}

/** Bundled sharp and libvips versions must match the notices table and source link. */
export async function checkBundled(text) {
  const { versions } = sharp
  const rows = text.split('\n').filter((line) => {
    return line.startsWith('| ')
  })

  const expected = { sharp: versions.sharp, libvips: versions.vips }

  for (const [name, version] of Object.entries(expected)) {
    const row = rows.find((line) => {
      return line.startsWith(`| ${name}`)
    })
    if (!row) throw new Error(`Missing ${name} row in THIRD_PARTY_NOTICES.md`)
    if (!row.includes(version)) {
      throw new Error(`${name} row must name version ${version}`)
    }
  }

  if (!text.includes('[licenses/LICENSE.lgpl3](licenses/LICENSE.lgpl3)')) {
    throw new Error('THIRD_PARTY_NOTICES.md must link licenses/LICENSE.lgpl3')
  }

  await checkLicenseLinks(text)

  if (sectionText(text, LIBVIPS_START, LIBVIPS_END) !== (await libvipsSection())) {
    throw new Error('THIRD_PARTY_NOTICES.md libvips rows are stale, run pnpm notices')
  }

  if (sectionText(text, GSTREAMER_START, GSTREAMER_END) !== gstreamerSection()) {
    throw new Error('THIRD_PARTY_NOTICES.md GStreamer rows are stale, run pnpm notices')
  }

  if (sectionText(text, SOURCE_START, SOURCE_END) !== (await sourceOfferSection())) {
    throw new Error('THIRD_PARTY_NOTICES.md source offer is stale, run pnpm notices')
  }

  await fs.access(LGPL)
  await fs.access(GPL)
  await fs.access(LGPL21)
}

/** Configure line per release target, built from versions.env and the profile file. */
async function ffmpegSection() {
  const versions = await fs.readFile(path.join(FFMPEG_DIR, 'versions.env'), 'utf8')
  const version = versions.match(/^FFMPEG_VERSION=(\S+)/m)?.[1]
  if (!version) throw new Error('Missing FFMPEG_VERSION in scripts/ffmpeg/versions.env')

  const profile = process.env.FFMPEG_PROFILE?.trim() || 'minimal'
  const profileText = await fs.readFile(path.join(FFMPEG_DIR, `profile-${profile}.txt`), 'utf8')
  const flags = profileText
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter(Boolean)

  const prefix = '--prefix=/opt/unplatform-ai-ffmpeg'
  const mac = [
    prefix,
    ...flags,
    "--extra-cflags='-mmacosx-version-min=13.0'",
    "--extra-ldflags='-mmacosx-version-min=13.0'",
  ]
  const linux = [prefix, ...flags, "--extra-ldflags='-static-libgcc'"]
  const windows = [
    prefix,
    '--target-os=mingw32',
    '--arch=x86_64',
    '--enable-cross-compile',
    '--cross-prefix=x86_64-w64-mingw32-',
    '--pkg-config=pkg-config',
    "--extra-ldflags='-static'",
    ...flags,
  ]

  return [
    '### ffmpeg build configure lines',
    '',
    `ffmpeg ${version}, profile \`${profile}\`. The binary is copied, never installed.`,
    '',
    '```',
    '# aarch64-apple-darwin',
    mac.join(' '),
    '# x86_64-unknown-linux-gnu',
    linux.join(' '),
    '# x86_64-pc-windows-msvc',
    windows.join(' '),
    '```',
  ].join('\n')
}

/** Replaces the text between two markers. */
function replaceSection(text, startMark, endMark, section) {
  const start = text.indexOf(startMark)
  const end = text.indexOf(endMark)
  if (start === -1 || end === -1 || end < start)
    throw new Error(`Missing ${startMark} or ${endMark}`)
  return `${text.slice(0, start + startMark.length)}\n\n${section.trim()}\n\n${text.slice(end)}`
}

async function main() {
  const text = await fs.readFile(NOTICES, 'utf8')
  const pkg = JSON.parse(await fs.readFile(PACKAGE, 'utf8'))

  if (process.argv.includes('--check')) {
    await checkBundled(text)
    checkAppLicense(text, pkg.license)
    console.log('[notices] bundled versions, license texts and bundled-library rows match')
    checkNpmSection(text, checkedNpmSection())
    await checkNpmLicenseTexts()
    const lock = await fs.readFile(LOCK, 'utf8')
    if ((await cargoRegistryRoots()).length === 0) {
      await checkCargoLicenseTexts(lock)
      console.log('[notices] cargo license files cover Cargo.lock, registry sources absent')
    } else {
      await checkLicenseTexts(await cargoLicenseEntries(), CARGO_LICENSES, 'licenses/cargo')
      console.log('[notices] npm and cargo license texts match')
    }

    return
  }

  let section
  try {
    section = npmSection()
  } catch (error) {
    console.warn(
      `[notices] pnpm licenses failed, keeping the committed npm section: ${error.message}`,
    )
    const start = text.indexOf(START)
    const end = text.indexOf(END)
    section = text.slice(start + START.length, end).trim()
  }

  let next = replaceSection(text, START, END, section)
  next = replaceSection(next, FFMPEG_START, FFMPEG_END, await ffmpegSection())
  next = replaceSection(next, LIBVIPS_START, LIBVIPS_END, await libvipsSection())
  next = replaceSection(next, GSTREAMER_START, GSTREAMER_END, gstreamerSection())
  next = replaceSection(next, SOURCE_START, SOURCE_END, await sourceOfferSection())
  await writeLicenseTexts(NPM_LICENSES, await npmLicenseEntries())
  await writeLicenseTexts(CARGO_LICENSES, await cargoLicenseEntries())
  await checkBundled(next)
  await fs.writeFile(NOTICES, next)
  checkAppLicense(next, pkg.license)

  await fs.mkdir(RESOURCES, { recursive: true })
  await fs.rm(path.join(RESOURCES, 'licenses'), { recursive: true, force: true })
  await fs.copyFile(NOTICES, path.join(RESOURCES, 'THIRD_PARTY_NOTICES.md'))
  await fs.copyFile(LICENSE, path.join(RESOURCES, 'LICENSE'))
  await fs.cp(LICENSES, path.join(RESOURCES, 'licenses'), { recursive: true })
  console.log('[notices] notices and licenses copied to src-tauri/resources')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (error) {
    console.error(`[notices] ${error.message}`)
    process.exit(1)
  }
}
