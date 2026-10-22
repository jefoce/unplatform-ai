import 'server-only'

import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { isNil } from 'lodash-es'

import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'

import { HttpError } from '../http'
import type { SystemAdapter } from './index'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

type Picker = 'zenity' | 'kdialog'

export const linux: SystemAdapter = {
  canChooseFiles: async () => !isNil(await picker()),

  async chooseFiles({ kinds, multiple: isMultiple, prompt }) {
    const tool = await picker()

    if (isNil(tool)) throw new HttpError(501, 'No file dialog available')

    const files = extensions(kinds)
    const args =
      tool === 'zenity'
        ? zenityFiles({ files, multiple: isMultiple, prompt })
        : kdialogFiles({ files, multiple: isMultiple, prompt })
    const { stdout } = await dialog(tool, args)

    return lines(stdout)
  },

  async chooseFolder({ prompt }) {
    const tool = await picker()

    if (isNil(tool)) throw new HttpError(501, 'No folder dialog available')

    let args = ['--getexistingdirectory', os.homedir(), '--title', prompt]

    if (tool === 'zenity') args = ['--file-selection', '--directory', `--title=${prompt}`]

    const { stdout } = await dialog(tool, args)

    const picked = stdout.trim()

    return picked === '' ? null : picked
  },

  async reveal(file) {
    await run('xdg-open', [path.dirname(file)])
  },
}

function extensions(kinds: readonly MediaKind[]): string[] {
  return acceptForKinds(kinds)
    .split(',')
    .filter(Boolean)
    .map((ext) => ext.slice(1))
}

interface FilesArgsParams {
  files: string[]
  multiple: boolean
  prompt: string
}

function zenityFiles(params: FilesArgsParams): string[] {
  const { files, multiple: isMultiple, prompt } = params
  const patterns = files.map((ext) => `*.${ext}`).join(' ')

  const args = ['--file-selection', `--title=${prompt}`, `--file-filter=Media | ${patterns}`]

  if (isMultiple) args.push('--multiple', '--separator=\n')

  return args
}

function kdialogFiles(params: FilesArgsParams): string[] {
  const { files, multiple: isMultiple, prompt } = params
  const patterns = files.map((ext) => `*.${ext}`).join(' ')

  const args = ['--getopenfilename', os.homedir(), `${patterns}|Media`, '--title', prompt]

  if (isMultiple) args.push('--multiple', '--separate-output')

  return args
}

function lines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function picker(): Promise<Picker | null> {
  if (await hasCommand('zenity')) return 'zenity'

  if (await hasCommand('kdialog')) return 'kdialog'

  return null
}

async function hasCommand(name: string): Promise<boolean> {
  return run('which', [name], { timeout: 5_000 }).then(
    () => true,
    () => false,
  )
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
  const err = error as { code?: number | string }

  return Number(err.code) === 1
}
