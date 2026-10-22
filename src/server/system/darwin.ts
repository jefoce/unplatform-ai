import 'server-only'

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'

import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'

import type { SystemAdapter } from './index'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

export const darwin: SystemAdapter = {
  canChooseFiles: async () => true,

  async chooseFiles({ kinds, multiple: isMultiple, prompt }) {
    const types = extensions(kinds)
      .map((ext) => `"${ext}"`)
      .join(', ')
    const typeClause = types === '' ? '' : ` of type {${types}}`
    const multipleClause = isMultiple ? ' with multiple selections allowed' : ''
    const script = [
      'tell application "System Events"',
      'activate',
      `set picked to choose file with prompt ${quote(prompt)}${typeClause}${multipleClause}`,
      'end tell',
    ]

    if (isMultiple) {
      script.push(
        'set out to ""',
        'repeat with f in (picked as list)',
        'set out to out & POSIX path of f & linefeed',
        'end repeat',
        'return out',
      )
    } else {
      script.push('return POSIX path of picked')
    }

    const { stdout } = await dialog(
      'osascript',
      script.flatMap((line) => ['-e', line]),
    )

    return lines(stdout)
  },

  async chooseFolder({ prompt }) {
    const script = [
      'tell application "System Events"',
      'activate',
      `set picked to choose folder with prompt ${quote(prompt)}`,
      'end tell',
      'return POSIX path of picked',
    ]
    const { stdout } = await dialog(
      'osascript',
      script.flatMap((line) => ['-e', line]),
    )

    const picked = stdout.trim()

    return picked === '' ? null : picked
  },

  async reveal(path) {
    const hasFile = await fs.stat(path).then(
      (stats) => stats.isFile(),
      () => false,
    )

    if (hasFile) {
      await run('open', ['-R', path])

      return
    }

    await run('open', [path])
  },
}

function extensions(kinds: readonly MediaKind[]): string[] {
  return acceptForKinds(kinds)
    .split(',')
    .filter(Boolean)
    .map((ext) => ext.slice(1))
}

function lines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Escapes a fixed prompt for an AppleScript string literal. */
function quote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

async function dialog(file: string, args: string[]) {
  try {
    return await run(file, args, { timeout: DIALOG_TIMEOUT, killSignal: 'SIGKILL' })
  } catch (error) {
    if (isCancel(error)) return { stdout: '', stderr: '' }

    throw error
  }
}

function isCancel(error: unknown): boolean {
  const err = error as { code?: number | string; stderr?: string }

  return Number(err.code) === 1 && /User canceled|-128/.test(err.stderr ?? '')
}
