import fs from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

const ROOTS = ['.github/workflows', '.github/actions']

type ActionRuntime = 'node24' | 'composite' | 'docker'

interface ActionPin {
  action: string
  sha: string
}

/** Runtime declared by the action at each pinned SHA, measured on GitHub. */
const ACTION_RUNTIMES: Record<string, ActionRuntime> = {
  '3d3c42e5aac5ba805825da76410c181273ba90b1': 'node24',
  '55cc8345863c7cc4c66a329aec7e433d2d1c52a9': 'node24',
  '005458ad77f1c8facd38a094e4af2e69e5607ff4': 'node24',
  b725eda525362e7cf34af9a7243cac1e3f01a7ec: 'composite',
  d1527c8f67ef9af357290475d4af4b0fab8f12e0: 'node24',
  '949feb2413d6458794dcd2491c4babbbce0c15c1': 'node24',
  ece7cb06caefa5fff74198d8649806c4678c61a1: 'node24',
  ea17c68df8912ef543352723c149a84f56e3d413: 'node24',
  cf430e030ddbb5b0abf93d22962f4752f3646cd9: 'node24',
  '9000827ccba6bdab643e8b6fd33ac0654aef8333': 'node24',
}

function workflowFiles(): string[] {
  return ROOTS.flatMap((root) => {
    return fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((name) => {
        return name.endsWith('.yml') || name.endsWith('.yaml')
      })
      .map((name) => {
        return path.join(root, name)
      })
  })
}

function actionPins(): ActionPin[] {
  return workflowFiles().flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8')

    return Array.from(text.matchAll(/uses:\s*(\S+)/g)).flatMap((match) => {
      const reference = match[1]

      if (isNil(reference) || reference.startsWith('./')) {
        return []
      }

      const at = reference.lastIndexOf('@')

      return [{ action: reference.slice(0, at), sha: reference.slice(at + 1) }]
    })
  })
}

describe('workflow action pins', () => {
  it('maps every external pin to a non node20 action runtime', () => {
    const pins = actionPins()

    expect(pins.length).toBeGreaterThan(0)

    for (const pin of pins) {
      const label = `${pin.action}@${pin.sha}`

      expect(ACTION_RUNTIMES[pin.sha], label).not.toBeUndefined()
      expect(ACTION_RUNTIMES[pin.sha], label).not.toBe('node20')
    }
  })
})
