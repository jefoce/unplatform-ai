import 'server-only'

import path from 'node:path'

import { EXPORT_TOKEN_TTL_MS } from '@/core/constants'

import { globalState } from '../global-state'

type ExportTokens = Map<string, number>

interface FolderGrant {
  uses: number
  expiresAt: number
}

const tokens = globalState<ExportTokens>('exportTokens', () => {
  return new Map()
})

const folders = globalState<Map<string, FolderGrant>>('exportFolders', () => {
  return new Map()
})

function keyOf(target: string): string {
  return path.resolve(target)
}

/** Remembers one path returned by the desktop save dialog. */
export function rememberExportPath(target: string): void {
  pruneExpired()
  tokens.set(keyOf(target), Date.now() + EXPORT_TOKEN_TTL_MS)
}

/** True once for a path the save dialog returned in the last 10 minutes. */
export function consumeExportPath(target: string): boolean {
  pruneExpired()

  const key = keyOf(target)

  if (!tokens.has(key)) {
    return false
  }

  tokens.delete(key)

  return true
}

/** Remembers a folder the desktop dialog returned, for `uses` batch requests. */
export function rememberExportFolder(dir: string, uses: number): void {
  pruneExpired()
  folders.set(keyOf(dir), { uses, expiresAt: Date.now() + EXPORT_TOKEN_TTL_MS })
}

/** True while a dialog folder grant still has uses left. */
export function consumeExportFolder(dir: string): boolean {
  pruneExpired()

  const key = keyOf(dir)
  const grant = folders.get(key)

  if (!grant) {
    return false
  }

  grant.uses -= 1

  if (grant.uses <= 0) {
    folders.delete(key)
  }

  return true
}

function pruneExpired(): void {
  const now = Date.now()

  for (const [key, expiresAt] of tokens) {
    if (expiresAt <= now) {
      tokens.delete(key)
    }
  }

  for (const [key, grant] of folders) {
    if (grant.expiresAt <= now) {
      folders.delete(key)
    }
  }
}
