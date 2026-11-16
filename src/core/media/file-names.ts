import { snapshotTitle } from '../record-source'
import type { RecordPreset } from '../schemas/generation-record'
import type { PresetSnapshot } from '../schemas/preset-snapshot'

interface PromptInput {
  prompt: string
}

interface PromptSlugRecord {
  input: PromptInput
  preset: RecordPreset
}

interface ModelNameRecord {
  preset: RecordPreset
  presetSnapshot?: PresetSnapshot
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

/** Kebab-case slug of the model title, at most 64 characters. */
export function modelSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replaceAll(/\p{M}+/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 64)
    .replaceAll(/-+$/g, '')

  return slug
}

/** Model name for a download, or an empty string so callers fall back. */
export function modelBase(record: ModelNameRecord): string {
  return modelSlug(snapshotTitle(record))
}
