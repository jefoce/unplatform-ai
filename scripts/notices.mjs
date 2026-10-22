#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const NOTICES = path.join(ROOT, 'THIRD_PARTY_NOTICES.md')
const LICENSE = path.join(ROOT, 'LICENSE')
const RESOURCES = path.join(ROOT, 'src-tauri', 'resources')
const FFMPEG_DIR = path.join(ROOT, 'scripts', 'ffmpeg')
const START = '<!-- npm-licenses:start -->'
const END = '<!-- npm-licenses:end -->'
const FFMPEG_START = '<!-- ffmpeg-buildconf:start -->'
const FFMPEG_END = '<!-- ffmpeg-buildconf:end -->'

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

/** Configure line per release target, built from versions.env and the profile file. */
async function ffmpegSection() {
  const versions = await fs.readFile(path.join(FFMPEG_DIR, 'versions.env'), 'utf8')
  const version = versions.match(/^FFMPEG_VERSION=(\S+)/m)?.[1]
  if (!version) throw new Error('Missing FFMPEG_VERSION in scripts/ffmpeg/versions.env')

  const profile = process.env.FFMPEG_PROFILE?.trim() || 'full'
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
  await fs.writeFile(NOTICES, next)

  await fs.mkdir(RESOURCES, { recursive: true })
  await fs.copyFile(NOTICES, path.join(RESOURCES, 'THIRD_PARTY_NOTICES.md'))
  await fs.copyFile(LICENSE, path.join(RESOURCES, 'LICENSE'))
  console.log('[notices] THIRD_PARTY_NOTICES.md and LICENSE copied to src-tauri/resources')
}

try {
  await main()
} catch (error) {
  console.error(`[notices] ${error.message}`)
  process.exit(1)
}
