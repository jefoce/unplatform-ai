import { isNonEmptyString } from '../guards'

const SEEDANCE_SUBJECT = {
  Image: 'image',
  Video: 'video',
  Audio: 'audio',
  Text: 'prompt',
} as const

export function matchedSubject(raw: string, pattern: RegExp): string | null {
  const found = raw.match(pattern)

  if (!found) {
    return null
  }

  return SEEDANCE_SUBJECT[found[1] as keyof typeof SEEDANCE_SUBJECT] ?? null
}

/** Param name from `InvalidParameter.Duration` or `InvalidParameter: duration`. */
function parameterName(raw: string): string | null {
  const dotted = raw.match(/(?:InvalidParameter|MissingParameter)\.([A-Za-z0-9_]+)/)

  if (dotted) {
    return dotted[1] ?? null
  }

  const after = raw.match(/(?:InvalidParameter|MissingParameter)[^:\n]*:\s*([A-Za-z0-9_.-]+)/)

  return after?.[1] ?? null
}

export function settingTitle(provider: string, raw: string): string {
  const name = parameterName(raw)

  if (!isNonEmptyString(name)) {
    return `${provider} rejected a setting.`
  }

  return `${provider} rejected a setting: ${name}.`
}
