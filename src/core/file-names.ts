import type { GenerationInput, GenerationRecord, RecordPreset } from './schemas/generation-record'

interface PromptSlugRecord {
  input: GenerationInput
  preset: RecordPreset
}

/** File-safe name from the prompt, falling back to the preset. */
export function promptSlug(record: PromptSlugRecord): string {
  const prompt = record.input.prompt.trim()
  const base = prompt === '' ? record.preset.slug : prompt

  const slug = base
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 60)

  if (slug === '') {
    return 'video'
  }

  return slug
}

/** Batch export name: prompt slug plus 6 id characters. */
export function exportName(record: GenerationRecord): string {
  return `${promptSlug(record)}-${record.id.slice(0, 6)}`
}
