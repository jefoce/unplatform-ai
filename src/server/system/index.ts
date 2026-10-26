import 'server-only'

import type { Dict } from '@/core/utility-types'

import { HttpError } from '../errors'
import { globalState } from '../global-state'
import { darwin } from './darwin'
import { linux } from './linux'
import type { SystemAdapter } from './types'
import { win32 } from './win32'

class DialogBusyError extends HttpError {
  constructor() {
    super(409, 'A dialog is already open')
    this.name = 'DialogBusyError'
  }
}

const ADAPTERS: Dict<SystemAdapter> = { darwin, win32, linux }

const dialog = globalState('dialog', () => {
  return { open: false }
})

/** Returns the adapter for this OS, or the Linux fallback. */
export function getSystem(): SystemAdapter {
  const adapter = ADAPTERS[process.platform] ?? linux

  return {
    canChooseFiles: () => {
      return adapter.canChooseFiles()
    },
    chooseFiles: (opts) => {
      return withDialog(() => {
        return adapter.chooseFiles(opts)
      })
    },
    chooseFolder: (opts) => {
      return withDialog(() => {
        return adapter.chooseFolder(opts)
      })
    },
    reveal: (path) => {
      return adapter.reveal(path)
    },
  }
}

/** Serializes dialogs and maps killed commands to a timeout response. */
async function withDialog<T>(task: () => Promise<T>): Promise<T> {
  if (dialog.open) {
    throw new DialogBusyError()
  }

  dialog.open = true

  try {
    return await task()
  } catch (error) {
    if (isTimeout(error)) {
      throw new HttpError(504, 'Dialog timed out')
    }

    throw error
  } finally {
    dialog.open = false
  }
}

interface CommandTimeoutError {
  killed?: boolean
  code?: string
}

function isTimeout(error: unknown): boolean {
  const err = error as CommandTimeoutError

  return err.killed === true || err.code === 'ETIMEDOUT'
}
