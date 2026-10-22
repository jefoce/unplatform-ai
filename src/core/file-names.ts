import type { GenerationRecord } from './types'

/** File-safe name from the prompt, falling back to the preset. */
export function promptSlug(record: Pick<GenerationRecord, 'input' | 'preset'>): string {
  const prompt = record.input.prompt.trim()
  const base = prompt === '' ? record.preset.slug : prompt
  const slug = base
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 60)

  return slug === '' ? 'video' : slug
}

/** Batch export name: prompt slug plus 6 id characters. */
export function exportName(record: GenerationRecord): string {
  return `${promptSlug(record)}-${record.id.slice(0, 6)}`
}
