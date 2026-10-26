import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Absolute path of a repo-relative file. */
export function file(rel: string): string {
  return path.join(ROOT, rel)
}

/** Rows of a markdown section's table, header excluded. */
export function tableRows(markdown: string, heading: string): string[][] {
  const lines = markdown.split('\n')

  const start = lines.findIndex((line) => {
    return line.trim() === `## ${heading}`
  })

  if (start === -1) {
    throw new Error(`Missing section: ${heading}`)
  }

  const rest = lines.slice(start + 1)

  const end = rest.findIndex((line) => {
    return line.startsWith('## ')
  })

  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n')

  return section
    .split('\n')
    .map((line) => {
      return line.trim()
    })
    .filter((line) => {
      return line.startsWith('|')
    })
    .map((line) => {
      return line
        .slice(1, -1)
        .split('|')
        .map((cell) => {
          return cell.trim().replaceAll('`', '')
        })
    })
    .filter((cells) => {
      return !cells.every((cell) => {
        return /^:?-{3,}:?$/.test(cell)
      })
    })
    .slice(1)
}
