import 'server-only'

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'

import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'

import type { SystemAdapter } from './types'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

export const darwin: SystemAdapter = {
  canChooseFiles: async () => {
    return true
  },

  async chooseFiles({ kinds, multiple: isMultiple, prompt }) {
    const types = extensions(kinds)
      .map((ext) => {
        return `"${ext}"`
      })
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
      script.flatMap((line) => {
        return ['-e', line]
      }),
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
      script.flatMap((line) => {
        return ['-e', line]
      }),
    )

    const picked = stdout.trim()

    if (picked === '') {
      return null
    }

    return picked
  },

  async reveal(path) {
    const hasFile = await fs.stat(path).then(
      (stats) => {
        return stats.isFile()
      },
      () => {
        return false
      },
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
    .map((ext) => {
      return ext.slice(1)
    })
}

function lines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => {
      return line.trim()
    })
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
    if (isCancel(error)) {
      return { stdout: '', stderr: '' }
    }

    throw error
  }
}

interface CommandError {
  code?: number | string
  stderr?: string
}

function isCancel(error: unknown): boolean {
  const err = error as CommandError

  return Number(err.code) === 1 && /User canceled|-128/.test(err.stderr ?? '')
}
