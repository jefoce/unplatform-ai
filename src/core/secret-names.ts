import { z } from 'zod'

export const SECRET_NAMES = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_MANAGEMENT_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const

export type SecretName = (typeof SECRET_NAMES)[number]

/** All set or all empty. */
export const R2_NAMES: readonly SecretName[] = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
]

const SecretValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .regex(/^[^\s]+$/, 'No spaces or line breaks')

/** One schema per key, also used to validate values read from disk. */
export const SECRET_SCHEMAS: Record<SecretName, z.ZodString> = {
  OPENROUTER_API_KEY: SecretValueSchema,
  OPENROUTER_MANAGEMENT_KEY: SecretValueSchema,
  R2_ACCOUNT_ID: SecretValueSchema.regex(/^[a-f0-9]{32}$/, 'Account ID is 32 hex characters'),
  R2_ACCESS_KEY_ID: SecretValueSchema.regex(/^[A-Za-z0-9]{16,128}$/, 'Letters and digits only'),
  R2_SECRET_ACCESS_KEY: SecretValueSchema,
  R2_BUCKET: SecretValueSchema.regex(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
    '3-63 lowercase letters, digits or hyphens',
  ),
}

/** First schema error for a value, or null when valid. */
export function secretError(name: SecretName, value: string): string | null {
  const parsed = SECRET_SCHEMAS[name].safeParse(value)

  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid value')
}
