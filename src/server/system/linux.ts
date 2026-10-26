import 'server-only'

import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { isNil } from 'lodash-es'

import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'

import { HttpError } from '../errors'
import type { SystemAdapter } from './types'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

type Picker = 'zenity' | 'kdialog'

export const linux: SystemAdapter = {
  canChooseFiles: async () => {
    return !isNil(await picker())
  },

  async chooseFiles({ kinds, multiple: isMultiple, prompt }) {
    const tool = await picker()

    if (isNil(tool)) {
      throw new HttpError(501, 'No file dialog available')
    }

    const files = extensions(kinds)

    let args: string[]

    if (tool === 'zenity') {
      args = zenityFiles({ files, multiple: isMultiple, prompt })
    } else {
      args = kdialogFiles({ files, multiple: isMultiple, prompt })
    }

    const { stdout } = await dialog(tool, args)

    return lines(stdout)
  },

  async chooseFolder({ prompt }) {
    const tool = await picker()

    if (isNil(tool)) {
      throw new HttpError(501, 'No folder dialog available')
    }

    let args = ['--getexistingdirectory', os.homedir(), '--title', prompt]

    if (tool === 'zenity') {
      args = ['--file-selection', '--directory', `--title=${prompt}`]
    }

    const { stdout } = await dialog(tool, args)

    const picked = stdout.trim()

    if (picked === '') {
      return null
    }

    return picked
  },

  async reveal(file) {
    await run('xdg-open', [path.dirname(file)])
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

interface FilesArgsParams {
  files: string[]
  multiple: boolean
  prompt: string
}

function zenityFiles(params: FilesArgsParams): string[] {
  const { files, multiple: isMultiple, prompt } = params

  const patterns = files
    .map((ext) => {
      return `*.${ext}`
    })
    .join(' ')

  const args = ['--file-selection', `--title=${prompt}`, `--file-filter=Media | ${patterns}`]

  if (isMultiple) {
    args.push('--multiple', '--separator=\n')
  }

  return args
}

function kdialogFiles(params: FilesArgsParams): string[] {
  const { files, multiple: isMultiple, prompt } = params

  const patterns = files
    .map((ext) => {
      return `*.${ext}`
    })
    .join(' ')

  const args = ['--getopenfilename', os.homedir(), `${patterns}|Media`, '--title', prompt]

  if (isMultiple) {
    args.push('--multiple', '--separate-output')
  }

  return args
}

function lines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => {
      return line.trim()
    })
    .filter(Boolean)
}

async function picker(): Promise<Picker | null> {
  if (await hasCommand('zenity')) {
    return 'zenity'
  }

  if (await hasCommand('kdialog')) {
    return 'kdialog'
  }

  return null
}

async function hasCommand(name: string): Promise<boolean> {
  return run('which', [name], { timeout: 5_000 }).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
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

interface CancelError {
  code?: number | string
}

function isCancel(error: unknown): boolean {
  const err = error as CancelError

  return Number(err.code) === 1
}
