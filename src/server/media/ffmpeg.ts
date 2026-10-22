import 'server-only'

import { type ChildProcess, execFile, type ExecFileException } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { isEmpty, isNil } from 'lodash-es'

import { FFMPEG_TIMEOUTS, PREVIEW_WIDTH } from '@/core/constants'

const MAX_BUFFER = 16 * 1024 * 1024

const running = new Set<ChildProcess>()

let resolvedPath: string | null = null

/** `ffmpeg-static` is dev-only: production ships the sidecar and sets FFMPEG_PATH. */
function devFfmpegPath(): string {
  if (process.env.NODE_ENV === 'production') return ''

  try {
    // Turbopack rewrites `require.resolve` calls, so invoke the method indirectly.
    const req = createRequire(import.meta.url)
    const specifier = ['ffmpeg-static', 'package.json'].join('/')
    const pkgPath: string = Reflect.apply(req.resolve, req, [specifier])
    const binary = path.join(
      path.dirname(pkgPath),
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    )

    return existsSync(binary) ? binary : ''
  } catch {
    return ''
  }
}

function ffmpegPath(): string {
  if (!isNil(resolvedPath)) return resolvedPath

  const configured = process.env.FFMPEG_PATH?.trim() ?? ''

  resolvedPath = isEmpty(configured) ? devFfmpegPath() : configured

  return resolvedPath
}

export interface FfmpegStatus {
  path: string
  exists: boolean
}

export interface MediaProbe {
  durationSec: number | null
  width: number | null
  height: number | null
}

let hasLogged = false

/** Reports the ffmpeg binary once per process. */
export function assertFfmpeg(): FfmpegStatus {
  const path = ffmpegPath()
  const hasBinary = !isEmpty(path) && existsSync(path)

  if (!hasLogged) {
    hasLogged = true
    console.log('[unplatform-ai] ffmpeg', path, hasBinary)
  }

  return { path, exists: hasBinary }
}

interface ExecFfmpegParams {
  args: string[]
  timeoutMs: number
}

/** Runs one ffmpeg child, tracks it for shutdown, and turns a timeout into a clear error. */
function execFfmpeg(
  params: ExecFfmpegParams,
): Promise<{ error: ExecFileException | null; stderr: string }> {
  const { args, timeoutMs } = params
  const bin = assertFfmpeg()

  if (!bin.exists) return Promise.reject(new Error('ffmpeg binary not found'))

  return new Promise((resolve, reject) => {
    const child = execFile(
      bin.path,
      args,
      {
        maxBuffer: MAX_BUFFER,
        encoding: 'utf8',
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
      },
      // eslint-disable-next-line @typescript-eslint/max-params -- fixed signature (execFile)
      (error, _stdout, stderr) => {
        running.delete(child)

        if (error?.killed === true) {
          reject(new Error(`ffmpeg timed out after ${timeoutMs} ms`))

          return
        }

        resolve({ error, stderr })
      },
    )

    running.add(child)
  })
}

/** Kills every ffmpeg child still running, so quit does not wait on one. */
export function stopAllFfmpeg(): void {
  for (const child of running) child.kill('SIGKILL')

  running.clear()
}

interface RunFfmpegParams {
  args: string[]
  timeoutMs: number
}

export async function runFfmpeg(params: RunFfmpegParams): Promise<void> {
  const { args, timeoutMs } = params
  const { error, stderr } = await execFfmpeg({
    args: ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args],
    timeoutMs,
  })

  if (error) throw new Error(`ffmpeg failed: ${stderr.slice(-2000)}`)
}

interface ExtractFrameParams {
  videoPath: string
  atSec: number
  width: number
  outPath: string
}

export async function extractFrame(params: ExtractFrameParams): Promise<void> {
  const { videoPath, atSec, width, outPath } = params
  const evenWidth = Math.max(2, Math.floor(width / 2) * 2)

  await runFfmpeg({
    args: [
      '-ss',
      String(atSec),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${evenWidth}:-2`,
      '-y',
      outPath,
    ],
    timeoutMs: FFMPEG_TIMEOUTS.frame,
  })
  await verifyFrame(outPath)
}

/** Reads duration and dimensions by parsing `ffmpeg -i` stderr. */
export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const stderr = await captureStderr(['-i', filePath])
  const duration = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr)
  const durationSec = duration
    ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
    : null

  const lines = stderr.split('\n')
  const videoLine = lines.find((line) => line.includes('Video:'))
  let candidates = lines

  if (!isNil(videoLine) && videoLine !== '') candidates = [videoLine, ...lines]

  for (const line of candidates) {
    const size = /(\d{2,5})x(\d{2,5})/.exec(line)

    if (!size) continue

    const width = Number(size[1])
    const height = Number(size[2])

    if (width > 0 && height > 0) return { durationSec, width, height }
  }

  return { durationSec, width: null, height: null }
}

interface ExtractBoundaryFrameParams {
  videoPath: string
  at: 'first' | 'last'
  outPath: string
}

export async function extractBoundaryFrame(params: ExtractBoundaryFrameParams): Promise<void> {
  const { videoPath, at, outPath } = params

  if (at === 'first') {
    const probe = await probeMedia(videoPath)

    await extractFrame({
      videoPath,
      atSec: 0,
      width: probe.width ?? PREVIEW_WIDTH,
      outPath,
    })

    return
  }

  await runFfmpeg({
    args: ['-sseof', '-1', '-i', videoPath, '-update', '1', '-q:v', '1', '-y', outPath],
    timeoutMs: FFMPEG_TIMEOUTS.frame,
  })
  await verifyFrame(outPath)
}

async function verifyFrame(outPath: string): Promise<void> {
  const stats = await fs.stat(outPath).catch(() => null)

  if (!stats || stats.size === 0) throw new Error('Frame extraction failed')
}

export async function makeTestVideo(
  outPath: string,
  opts: { width: number; height: number; durationSec: number },
): Promise<void> {
  await runFfmpeg({
    args: [
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=${opts.width}x${opts.height}:rate=24`,
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      String(opts.durationSec),
      '-shortest',
      '-pix_fmt',
      'yuv420p',
      '-y',
      outPath,
    ],
    timeoutMs: FFMPEG_TIMEOUTS.mock,
  })
}

async function captureStderr(args: string[]): Promise<string> {
  const { error, stderr } = await execFfmpeg({
    args: ['-nostdin', ...args],
    timeoutMs: FFMPEG_TIMEOUTS.probe,
  })

  if (error?.code === 'ENOENT') throw new Error('ffmpeg binary not found')

  // `ffmpeg -i` exits non-zero without an output file, stderr still holds the probe.
  return stderr
}
