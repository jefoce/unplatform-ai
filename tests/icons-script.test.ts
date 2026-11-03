import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

interface PackageJson {
  scripts: Record<string, string>
}

const root = path.resolve('.')

describe('icons script', () => {
  it('runs the icon steps in order', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJson
    const script = pkg.scripts.icons ?? ''

    const steps = [
      'tauri icon app-icon.png',
      'generate-mac-icon.mjs',
      'generate-favicon.mjs',
      'generate-header.sh',
    ]

    const positions = steps.map((step) => {
      return script.indexOf(step)
    })

    for (const position of positions) {
      expect(position).toBeGreaterThanOrEqual(0)
    }

    expect(positions).toEqual(
      [...positions].sort((a, b) => {
        return a - b
      }),
    )
  })

  it('ignores the iOS and Android icon folders', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8')

    expect(gitignore).toContain('src-tauri/icons/ios/')
    expect(gitignore).toContain('src-tauri/icons/android/')
  })
})
