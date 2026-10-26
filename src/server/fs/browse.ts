import 'server-only'

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil, orderBy } from 'lodash-es'

import type { BrowseResult } from '@/core/media-types'

import { HttpError } from '../errors'

class BrowseError extends HttpError {}

export interface BrowseInput {
  path?: string
  hidden?: boolean
}

export async function browseDirectories(input: BrowseInput): Promise<BrowseResult> {
  const isRequested = isNil(input.path) || input.path.trim() === ''
  let requested = os.homedir()

  if (!isRequested) {
    requested = input.path ?? ''
  }

  if (!path.isAbsolute(requested)) {
    throw new BrowseError(400, 'Path must be absolute')
  }

  let real: string

  try {
    real = await fs.realpath(requested)
  } catch {
    throw new BrowseError(404, 'Path not found')
  }

  const stats = await fs.stat(real)

  if (!stats.isDirectory()) {
    throw new BrowseError(400, 'Not a directory')
  }

  const entries = await fs.readdir(real, { withFileTypes: true })

  const dirs = orderBy(
    entries
      .filter((entry) => {
        return entry.isDirectory()
      })
      .filter((entry) => {
        return input.hidden === true || !entry.name.startsWith('.')
      })
      .map((entry) => {
        return { name: entry.name, path: path.join(real, entry.name) }
      }),
    ['name'],
    ['asc'],
  )

  let parent: string | null = path.dirname(real)

  if (real === path.parse(real).root) {
    parent = null
  }

  return { path: real, parent, dirs }
}
