import { describe, expect, it } from 'vitest'

import type { CatalogEntry } from '@/core/catalog'
import type { VideoPreset } from '@/core/presets/video/types'
import { pickerGroups } from '@/features/generator/model/picker-groups'
import { searchGroups } from '@/features/generator/model/picker-view'

import { getPreset } from '../src/core/presets'

const PRESET: VideoPreset = {
  ...getPreset('wan-3.0'),
  id: 'custom.cu1.local',
  title: 'Local Wan',
  family: 'custom',
  description: 'Runs on the local ComfyUI box',
}

const ENTRY: CatalogEntry = {
  modelId: PRESET.id,
  presetId: PRESET.id,
  provider: 'custom',
  status: 'available',
  reason: null,
  pricing: null,
  source: {
    kind: 'custom',
    instanceId: 'cu1',
    badge: 'CU1',
    workflowName: 'local-wan-workflow',
    local: true,
  },
  preset: PRESET,
}

const GROUPS = pickerGroups({ models: [], entries: [ENTRY], kind: 'video' })

function rowIds(groups: ReturnType<typeof searchGroups>): string[] {
  return groups.flatMap((group) => {
    return group.rows.map((row) => {
      return row.id
    })
  })
}

describe('model picker search', () => {
  it('matches a word from the description', () => {
    expect(rowIds(searchGroups(GROUPS, 'comfyui'))).toContain(PRESET.id)
  })

  it('ignores the workflow name', () => {
    expect(rowIds(searchGroups(GROUPS, 'local-wan-workflow'))).not.toContain(PRESET.id)
  })
})
