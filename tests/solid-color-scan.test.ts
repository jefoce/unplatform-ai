import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve('src')
const BLUR = 'backdrop-blur'
const LINUX_BACKGROUND = /linux:bg-([a-z0-9-]+)/g
const TOKEN = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g

/** Every .ts and .tsx file under src. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(full)
    }

    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      return []
    }

    return [full]
  })
}

/** Token values after the Linux block, which overrides the theme values. */
function tokenValues(): Map<string, string> {
  const css = fs.readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
  const values = new Map<string, string>()

  for (const match of css.matchAll(TOKEN)) {
    values.set(String(match[1]), String(match[2]))
  }

  return values
}

function hasAlpha(value: string): boolean {
  if (value.startsWith('#')) {
    const hex = value.slice(1)

    if (hex.length === 4) {
      return hex[3] !== 'f'
    }

    if (hex.length === 8) {
      return hex.slice(6).toLowerCase() !== 'ff'
    }

    return false
  }

  const channels = value.slice(value.indexOf('(') + 1, -1).split(',')

  return channels.length === 4 && Number(channels[3]) < 1
}

function linuxBackgrounds(line: string): string[] {
  return [...line.matchAll(LINUX_BACKGROUND)].map((match) => {
    return String(match[1])
  })
}

interface BlurLine {
  file: string
  number: number
  line: string
}

const files = sourceFiles(SRC)
const values = tokenValues()

function blurLines(): BlurLine[] {
  return files.flatMap((file) => {
    const relative = path.relative(SRC, file)

    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) => {
        const entry = { file: relative, number: index + 1, line }

        return line.includes(BLUR) ? [entry] : []
      })
  })
}

function lineFailures(entry: BlurLine): string[] {
  const where = `${entry.file}:${String(entry.number)}`
  const names = linuxBackgrounds(entry.line)

  if (names.length === 0) {
    return [`${where} has no linux:bg token`]
  }

  return names.flatMap((name) => {
    const value = values.get(name)

    if (value === undefined) {
      return [`${where} unknown token ${name}`]
    }

    if (hasAlpha(value)) {
      return [`${where} ${name} has alpha`]
    }

    return []
  })
}

describe('Linux solid fallback', () => {
  it('gives every backdrop-blur class an opaque Linux background', () => {
    expect(blurLines().flatMap(lineFailures)).toEqual([])
  })
})
