#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import sharp from 'sharp'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const NOTICES = path.join(ROOT, 'THIRD_PARTY_NOTICES.md')
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
    'Ubuntu 22.04',
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gstreamer',
  ],
  [
    'gst-plugins-base',
    'Ubuntu 22.04',
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-base',
  ],
  [
    'gst-plugins-good',
    'Ubuntu 22.04',
    'LGPL-2.1-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-good',
  ],
  [
    'gst-plugins-bad',
    'Ubuntu 22.04',
    'LGPL-2.0-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-plugins-bad',
  ],
  [
    'gst-libav',
    'Ubuntu 22.04',
    'LGPL-2.1-or-later',
    'https://gitlab.freedesktop.org/gstreamer/gst-libav',
  ],
]

/** npm production dependency list from pnpm, sorted by license and name. */
function npmSection() {
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
  const groups = JSON.parse(raw)
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

/** npm section in the notices must match the one generated from the lockfile. */
export function checkNpmSection(text, section) {
  if (sectionText(text, START, END) !== section.trim()) {
    throw new Error('THIRD_PARTY_NOTICES.md npm section is stale, run pnpm notices')
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

/** Every `licenses/<name>` link in the notices must resolve to a file under root. */
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

  if (process.argv.includes('--check')) {
    await checkBundled(text)
    console.log('[notices] bundled versions, license texts and bundled-library rows match')
    checkNpmSection(text, checkedNpmSection())
    console.log('[notices] npm production dependencies match')

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
  await checkBundled(next)
  await fs.writeFile(NOTICES, next)

  await fs.mkdir(path.join(RESOURCES, 'licenses'), { recursive: true })
  await fs.copyFile(NOTICES, path.join(RESOURCES, 'THIRD_PARTY_NOTICES.md'))
  await fs.copyFile(LICENSE, path.join(RESOURCES, 'LICENSE'))
  await fs.copyFile(LGPL, path.join(RESOURCES, 'licenses', 'LICENSE.lgpl3'))
  await fs.copyFile(GPL, path.join(RESOURCES, 'licenses', 'COPYING.GPLv3'))
  await fs.copyFile(LGPL21, path.join(RESOURCES, 'licenses', 'COPYING.LGPLv2.1'))
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
