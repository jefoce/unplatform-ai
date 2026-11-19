#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'

import sharp from 'sharp'

import { SPDX_TEXTS } from './spdx-texts.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKAGE = path.join(ROOT, 'package.json')
const NOTICES = path.join(ROOT, 'THIRD_PARTY_NOTICES.md')
const TEXT = path.join(ROOT, 'THIRD_PARTY_LICENSES.txt')
const ARCHIVE = `${TEXT}.gz`
const CARGO_DIR = path.join(ROOT, 'src-tauri')
const LICENSE = path.join(ROOT, 'LICENSE')
const LICENSES = path.join(ROOT, 'licenses')
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
/**
 * Lines that state a copyright, kept with the package instead of the text body.
 */
const COPYRIGHT_LINE = /^(?:copyright\b|\(c\)|©|copr\.).*(?:\d{4}|\(c\)|©|\[yyyy\])/i

/**
 * Section rule in the generated license document.
 */
const SECTION_RULE = '='.repeat(80)

/**
 * Targets the release installers build for.
 */
const RELEASE_TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-pc-windows-msvc',
  'x86_64-unknown-linux-gnu',
]

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
 * Text with CRLF removed, trailing spaces dropped and blank runs collapsed.
 */
function normalizeText(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      return line.replace(/[ \t]+$/, '')
    })

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Copyright notices kept with the package, and the remaining license body.
 */
function splitLicenseText(text) {
  const notices = []
  const body = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (COPYRIGHT_LINE.test(trimmed)) {
      notices.push(trimmed.replace(/\s+/g, ' '))
      continue
    }
    body.push(line)
  }

  return { notices: [...new Set(notices)], body: normalizeText(body.join('\n')) }
}

/**
 * One license text, with the package that ships it, its license id and marker.
 */
function licenseItem(params) {
  const { name, version, text, license, marker = null } = params

  return { name, version, text, license, marker }
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
 * SPDX License List text for an identifier.
 */
function spdxText(id, pkg) {
  const text = SPDX_TEXTS[id]
  if (!text) throw new Error(`${pkg.name} ${pkg.version} needs the SPDX text for ${id}`)

  return text
}

/**
 * License items for the shipped npm production packages.
 */
async function npmLicenseItems() {
  const items = []
  const groups = npmGroups()
  for (const license of Object.keys(groups).sort()) {
    const packages = [...groups[license]].sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
    for (const pkg of packages) {
      for (const [index, version] of pkg.versions.entries()) {
        const dir = pkg.paths[index] ?? pkg.paths[0]
        const files = await licenseFiles(dir)
        if (files.length > 0) {
          for (const file of files) {
            items.push(licenseItem({ name: pkg.name, version, text: file.text, license }))
          }
          continue
        }
        for (const id of licenseIds(license)) {
          const marker = `no license file, SPDX ${id} text`
          items.push(
            licenseItem({ name: pkg.name, version, text: spdxText(id, pkg), license: id, marker }),
          )
        }
      }
    }
  }

  return items
}

/**
 * Order packages by name, then version.
 */
function comparePackages(a, b) {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  if (a.version !== b.version) return a.version < b.version ? -1 : 1

  return 0
}

/**
 * Registry packages in Cargo.lock, sorted by name and version.
 */
function cargoPackages(lockText) {
  const packages = []
  for (const block of lockText.split('[[package]]').slice(1)) {
    const name = block.match(/^name = "(.+)"$/m)?.[1]
    const version = block.match(/^version = "(.+)"$/m)?.[1]
    const source = block.match(/^source = "(.+)"$/m)?.[1]
    if (!name || !version || !source?.startsWith('registry+')) continue
    packages.push({ name, version })
  }

  return packages.sort(comparePackages)
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
 * Registry crates that ship in the three release targets, with per-target names.
 */
export async function cargoShippedPackages(manifestDir = CARGO_DIR) {
  const lock = await fs.readFile(path.join(manifestDir, 'Cargo.lock'), 'utf8')
  const registry = new Map(
    cargoPackages(lock).map((pkg) => {
      return [`${pkg.name} ${pkg.version}`, pkg]
    }),
  )
  const union = new Map()
  const perTarget = {}
  for (const target of RELEASE_TARGETS) {
    const output = execFileSync(
      'cargo',
      [
        'tree',
        '-e',
        'normal,no-proc-macro',
        '--target',
        target,
        '--prefix',
        'none',
        '--format',
        '{p}',
        '--no-dedupe',
        '--locked',
      ],
      { cwd: manifestDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
    const shipped = new Map()
    for (const line of output.split('\n')) {
      const match = line.trim().match(/^(\S+) v(\S+)/)
      if (!match) continue
      const key = `${match[1]} ${match[2]}`
      const pkg = registry.get(key)
      if (!pkg) continue
      shipped.set(key, pkg)
      union.set(key, pkg)
    }
    perTarget[target] = [...shipped.values()].sort(comparePackages)
  }

  return { perTarget, packages: [...union.values()].sort(comparePackages) }
}

/**
 * License items for the crates shipped in the release targets.
 */
async function cargoLicenseItems() {
  const roots = await cargoRegistryRoots()
  const { packages } = await cargoShippedPackages()
  const items = []
  for (const pkg of packages) {
    const dir = await crateDir(roots, pkg)
    if (dir === null) {
      throw new Error(
        `Missing cargo registry source for ${pkg.name} ${pkg.version}, run cargo fetch`,
      )
    }

    const toml = await fs.readFile(path.join(dir, 'Cargo.toml'), 'utf8')
    const license = cargoPackageSection(toml).match(/^license\s*=\s*"([^"]+)"/m)?.[1]
    if (!license) throw new Error(`Missing license field for ${pkg.name} ${pkg.version}`)

    const files = await licenseFiles(dir)
    if (files.length > 0) {
      for (const file of files) {
        items.push(licenseItem({ name: pkg.name, version: pkg.version, text: file.text, license }))
      }
      continue
    }
    for (const id of licenseIds(license)) {
      const marker = `no license file, SPDX ${id} text`
      items.push(
        licenseItem({
          name: pkg.name,
          version: pkg.version,
          text: spdxText(id, pkg),
          license: id,
          marker,
        }),
      )
    }
  }

  return items
}

/**
 * One license body shared by several packages.
 */
function groupLicenseItems(items) {
  const groups = new Map()
  for (const item of items) {
    const { notices, body } = splitLicenseText(item.text)
    if (body === '') throw new Error(`${item.name} ${item.version} has no license text`)

    const key = body.replace(/\s+/g, ' ').toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = { body, license: item.license, rows: new Map() }
      groups.set(key, group)
    }

    const label = `${item.name} ${item.version}`
    let row = group.rows.get(label)
    if (!row) {
      row = { name: item.name, version: item.version, notices: new Set(), marker: null }
      group.rows.set(label, row)
    }
    for (const notice of notices) row.notices.add(notice)
    if (item.marker !== null) row.marker = item.marker
  }

  return [...groups.values()].map((group) => {
    return { ...group, rows: [...group.rows.values()].sort(comparePackages) }
  })
}

/**
 * Short title for a license body.
 */
function licenseTitle(body) {
  const line = body.split('\n').find((entry) => {
    return entry.trim() !== ''
  })
  const title = line?.trim() ?? ''
  if (title === '' || title.length > 60) return 'License text'

  return title
}

/**
 * License document with a contents table, one section per unique text.
 */
function renderLicenseDocument(items) {
  const groups = groupLicenseItems(items)
    .map((group) => {
      const title = group.license === '' ? licenseTitle(group.body) : group.license

      return { ...group, title }
    })
    .sort((a, b) => {
      if (a.title !== b.title) return a.title < b.title ? -1 : 1

      return a.body < b.body ? -1 : 1
    })

  const rows = []
  groups.forEach((group, index) => {
    for (const row of group.rows) rows.push({ ...row, section: index + 1 })
  })
  rows.sort(comparePackages)

  const nameWidth = Math.max(7, ...rows.map((row) => row.name.length))
  const versionWidth = Math.max(7, ...rows.map((row) => row.version.length))
  const lines = [
    'Third-party license texts',
    '=========================',
    '',
    'Full license texts of the npm production packages and the Rust crates that ship in the desktop',
    'installers. Identical texts are printed once, followed by every package that uses them and the',
    'copyright lines from its license file. A package marked SPDX ships no license file and uses the',
    'SPDX License List text. Generated by `pnpm notices`. Do not edit.',
    '',
    'Contents',
    '--------',
    '',
    `${'Package'.padEnd(nameWidth)} | ${'Version'.padEnd(versionWidth)} | Text`,
    `${'-'.repeat(nameWidth)} | ${'-'.repeat(versionWidth)} | ----`,
  ]
  for (const row of rows) {
    lines.push(
      `${row.name.padEnd(nameWidth)} | ${row.version.padEnd(versionWidth)} | ${String(row.section).padStart(4)}`,
    )
  }

  groups.forEach((group, index) => {
    lines.push('', SECTION_RULE, `${index + 1}. ${group.title}`, SECTION_RULE, '', 'Packages:')
    for (const row of group.rows) {
      const marker = row.marker === null ? '' : ` (${row.marker})`
      lines.push(`  ${row.name} ${row.version}${marker}`)
      for (const notice of [...row.notices].sort()) lines.push(`    ${notice}`)
    }
    lines.push('', group.body)
  })

  return `${lines.join('\n')}\n`
}

/**
 * License document for the current npm and cargo package sets.
 */
export async function buildLicenseDocument() {
  const npm = await npmLicenseItems()
  const cargo = await cargoLicenseItems()

  return renderLicenseDocument([...npm, ...cargo])
}

/**
 * Deterministic gzip bytes. Node writes a zero modification time.
 */
function gzipText(text) {
  return gzipSync(Buffer.from(text, 'utf8'), { level: 9 })
}

/**
 * Every package in the contents must have a section with a text body.
 */
export function checkLicenseDocument(text) {
  const chunks = text.split(`${SECTION_RULE}\n`)
  if (chunks.length < 3) throw new Error('THIRD_PARTY_LICENSES.txt has no license sections')

  const contents = new Map()
  for (const line of chunks[0].split('\n')) {
    const match = line.match(/^(.+?)\s+\| (\S+)\s+\| +(\d+)$/)
    if (!match) continue
    const label = `${match[1].trim()} ${match[2]}`
    const section = Number(match[3])
    const labels = contents.get(section) ?? new Set()
    labels.add(label)
    contents.set(section, labels)
  }
  if (contents.size === 0) throw new Error('THIRD_PARTY_LICENSES.txt has no contents table')

  const found = new Map()
  for (let index = 1; index + 1 < chunks.length; index += 2) {
    const header = chunks[index].match(/^(\d+)\. (.+)$/m)
    if (!header) throw new Error('THIRD_PARTY_LICENSES.txt has a section without a number')

    const section = Number(header[1])
    const lines = chunks[index + 1].split('\n')
    const start = lines.indexOf('Packages:')
    if (start === -1) {
      throw new Error(`THIRD_PARTY_LICENSES.txt section ${section} has no packages`)
    }

    let cursor = start + 1
    const labels = new Set()
    while (
      cursor < lines.length &&
      (lines[cursor].startsWith('  ') || lines[cursor].trim() === '')
    ) {
      if (!lines[cursor].startsWith('    ')) {
        const match = lines[cursor].trim().match(/^(\S+) (\S+?)(?: \((.+)\))?$/)
        if (match) labels.add(`${match[1]} ${match[2]}`)
      }
      cursor += 1
    }

    if (lines.slice(cursor).join('\n').trim() === '') {
      throw new Error(`THIRD_PARTY_LICENSES.txt section ${section} has no license text`)
    }
    found.set(section, labels)
  }

  for (const [section, labels] of contents) {
    const sectionLabels = found.get(section)
    if (!sectionLabels) throw new Error(`THIRD_PARTY_LICENSES.txt section ${section} is missing`)
    for (const label of labels) {
      if (!sectionLabels.has(label)) {
        throw new Error(`THIRD_PARTY_LICENSES.txt lists ${label} without a license text`)
      }
    }
  }
  for (const [section, labels] of found) {
    for (const label of labels) {
      if (!contents.get(section)?.has(label)) {
        throw new Error(
          `THIRD_PARTY_LICENSES.txt section ${section} lists ${label} off the contents`,
        )
      }
    }
  }
}

/**
 * Archive must decompress to the expected license text.
 * Compressed bytes differ across zlib builds, the text does not.
 */
export function checkLicenseArchiveContent(archive, expected) {
  if (archive.length < 10 || archive.readUInt32LE(4) !== 0) {
    throw new Error('THIRD_PARTY_LICENSES.txt.gz has a timestamp, run pnpm notices')
  }

  let text
  try {
    text = gunzipSync(archive).toString('utf8')
  } catch (error) {
    throw new Error('THIRD_PARTY_LICENSES.txt.gz is corrupt, run pnpm notices', { cause: error })
  }
  if (text !== expected) throw new Error('THIRD_PARTY_LICENSES.txt.gz is stale, run pnpm notices')
}

/**
 * Committed text and archive must match a fresh generation.
 */
export async function checkLicenseArchive(params = {}) {
  const { textPath = TEXT, archivePath = ARCHIVE } = params
  const expected = await buildLicenseDocument()
  checkLicenseDocument(expected)

  const text = await fs.readFile(textPath, 'utf8').catch(() => null)
  if (text === null) throw new Error('THIRD_PARTY_LICENSES.txt is missing, run pnpm notices')
  checkLicenseDocument(text)
  if (text !== expected) throw new Error('THIRD_PARTY_LICENSES.txt is stale, run pnpm notices')

  const archive = await fs.readFile(archivePath).catch(() => null)
  if (archive === null) throw new Error('THIRD_PARTY_LICENSES.txt.gz is missing, run pnpm notices')
  checkLicenseArchiveContent(archive, expected)
}

/**
 * Writes the text and its deterministic gzip, returning the archive bytes.
 */
async function writeLicenseArchive() {
  const document = await buildLicenseDocument()
  checkLicenseDocument(document)
  const archive = gzipText(document)
  await fs.writeFile(TEXT, document)
  await fs.writeFile(ARCHIVE, archive)

  return archive
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

/**
 * Copies the original license texts, never the generated per-package trees.
 */
async function copyLicenseOriginals(dir) {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  for (const entry of await fs.readdir(LICENSES, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    await fs.copyFile(path.join(LICENSES, entry.name), path.join(dir, entry.name))
  }
}

/**
 * Copies the notices, license, license archive and originals into a resources dir.
 */
export async function stageResources(dir = RESOURCES) {
  await fs.mkdir(dir, { recursive: true })
  await fs.copyFile(NOTICES, path.join(dir, 'THIRD_PARTY_NOTICES.md'))
  await fs.copyFile(LICENSE, path.join(dir, 'LICENSE'))
  await fs.copyFile(ARCHIVE, path.join(dir, 'THIRD_PARTY_LICENSES.txt.gz'))
  await copyLicenseOriginals(path.join(dir, 'licenses'))
}

/**
 * Replaces the text between two markers.
 */
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
    checkNpmSection(text, checkedNpmSection())
    await checkLicenseArchive()
    console.log('[notices] bundled versions, npm section and license archive match')

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
  await writeLicenseArchive()
  await checkBundled(next)
  await fs.writeFile(NOTICES, next)
  checkAppLicense(next, pkg.license)

  await stageResources()
  console.log('[notices] notices and license archive copied to src-tauri/resources')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (error) {
    console.error(`[notices] ${error.message}`)
    process.exit(1)
  }
}
