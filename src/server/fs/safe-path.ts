import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { HttpError } from '../errors'

export class SafePathError extends HttpError {
  constructor() {
    super(400, 'Invalid path')
  }
}

/** Resolves `rel` under `root`, rejecting anything that escapes it. */
export function resolveInside(root: string, rel: string): string {
  if (root.includes('\0') || rel.includes('\0')) {
    throw new SafePathError()
  }

  const resolvedRoot = path.resolve(root)
  const absolute = path.resolve(resolvedRoot, rel)

  if (!isInside(resolvedRoot, absolute)) {
    throw new SafePathError()
  }

  return absolute
}

export function isInside(root: string, abs: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(abs)

  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
}

/** Resolves symlinks for both paths and rejects anything outside the real root. */
export async function resolveRealInside(root: string, abs: string): Promise<string> {
  const [rootReal, real] = await Promise.all([fs.realpath(root), fs.realpath(abs)])

  if (!isInside(rootReal, real)) {
    throw new SafePathError()
  }

  return real
}
