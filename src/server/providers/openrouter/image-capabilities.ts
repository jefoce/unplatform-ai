import 'server-only'

import { isBoolean, isNil, isString } from 'lodash-es'

import { isRecord } from '@/core/guards'

export interface ImageCapabilities {
  resolutions: readonly string[] | null
  aspectRatios: readonly string[] | null
  qualities: readonly string[] | null
  backgrounds: readonly string[] | null
  maxN: number | null
  referenceMax: number | null
  hasSeed: boolean | null
}

interface AbsentRead {
  status: 'absent'
}

interface BadRead {
  status: 'bad'
}

interface OkRead<T> {
  status: 'ok'
  value: T
}

type FieldRead<T> = AbsentRead | BadRead | OkRead<T>

interface CapabilityRead {
  capabilities: ImageCapabilities
  fields: string[]
}

interface PickParams<T> {
  params: Record<string, unknown>
  keys: readonly string[]
  read: (value: unknown) => FieldRead<T>
  fallback: T
  fields: string[]
}

const warnings = new Set<string>()

/** Tolerant parser. A bad field only nulls that capability and warns once per model. */
export function readImageCapabilities(modelId: string, raw: unknown): ImageCapabilities {
  const { capabilities, fields } = readCapabilities(raw)

  if (fields.length > 0 && !warnings.has(modelId)) {
    warnings.add(modelId)
    console.warn(`[image-models] ${modelId} unsupported fields: ${fields.join(', ')}`)
  }

  return capabilities
}

function readCapabilities(raw: unknown): CapabilityRead {
  const empty = emptyCapabilities()

  if (isNil(raw)) {
    return { capabilities: empty, fields: [] }
  }

  if (!isRecord(raw)) {
    return { capabilities: empty, fields: ['supported_parameters'] }
  }

  const fields: string[] = []

  const capabilities: ImageCapabilities = {
    resolutions: pickValue<readonly string[] | null>({
      params: raw,
      keys: ['resolution', 'resolutions'],
      read: readStringList,
      fallback: null,
      fields,
    }),
    aspectRatios: pickValue<readonly string[] | null>({
      params: raw,
      keys: ['aspect_ratio', 'aspect_ratios'],
      read: readStringList,
      fallback: null,
      fields,
    }),
    qualities: pickValue<readonly string[] | null>({
      params: raw,
      keys: ['quality', 'qualities'],
      read: readStringList,
      fallback: null,
      fields,
    }),
    backgrounds: pickValue<readonly string[] | null>({
      params: raw,
      keys: ['background', 'backgrounds'],
      read: readStringList,
      fallback: null,
      fields,
    }),
    maxN: pickValue<number | null>({
      params: raw,
      keys: ['n'],
      read: readCount,
      fallback: null,
      fields,
    }),
    referenceMax: pickValue<number | null>({
      params: raw,
      keys: ['input_references', 'references'],
      read: readCount,
      fallback: null,
      fields,
    }),
    hasSeed: pickValue<boolean | null>({
      params: raw,
      keys: ['seed'],
      read: readSeed,
      fallback: null,
      fields,
    }),
  }

  return { capabilities, fields }
}

function emptyCapabilities(): ImageCapabilities {
  return {
    resolutions: null,
    aspectRatios: null,
    qualities: null,
    backgrounds: null,
    maxN: null,
    referenceMax: null,
    hasSeed: null,
  }
}

function pickValue<T>(input: PickParams<T>): T {
  const { params, keys, read, fallback, fields } = input
  let hasBadValue = false

  for (const key of keys) {
    if (!(key in params)) {
      continue
    }

    const raw = params[key]

    if (isNil(raw)) {
      continue
    }

    const parsed = read(raw)

    if (parsed.status === 'ok') {
      return parsed.value
    }

    hasBadValue = true
  }

  if (hasBadValue) {
    fields.push(keys[0] ?? 'supported_parameters')
  }

  return fallback
}

function readStringList(value: unknown): FieldRead<readonly string[]> {
  if (Array.isArray(value)) {
    if (!isStringList(value)) {
      return { status: 'bad' }
    }

    return { status: 'ok', value }
  }

  if (!isRecord(value)) {
    return { status: 'bad' }
  }

  const values = value.values

  if (!Array.isArray(values) || !isStringList(values)) {
    return { status: 'bad' }
  }

  if ('type' in value && value.type !== 'enum') {
    return { status: 'bad' }
  }

  return { status: 'ok', value: values }
}

function readCount(value: unknown): FieldRead<number | null> {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { status: 'bad' }
    }

    return { status: 'ok', value }
  }

  if (Array.isArray(value)) {
    return readCountArray(value)
  }

  if (isRecord(value)) {
    return readCountObject(value)
  }

  return { status: 'bad' }
}

function readCountArray(value: readonly unknown[]): FieldRead<number | null> {
  if (!value.every(isFiniteNumber)) {
    return { status: 'bad' }
  }

  if (value.length === 0) {
    return { status: 'ok', value: null }
  }

  return { status: 'ok', value: Math.max(...value) }
}

function readCountObject(value: Record<string, unknown>): FieldRead<number | null> {
  if ('type' in value && value.type !== 'range') {
    return { status: 'bad' }
  }

  const max = value.max

  if (!('max' in value) || isNil(max)) {
    return { status: 'ok', value: null }
  }

  if (typeof max === 'number' && Number.isFinite(max)) {
    return { status: 'ok', value: max }
  }

  return { status: 'bad' }
}

function readSeed(value: unknown): FieldRead<boolean | null> {
  if (isBoolean(value)) {
    return { status: 'ok', value }
  }

  if (!isRecord(value)) {
    return { status: 'bad' }
  }

  if (value.type === 'boolean') {
    return { status: 'ok', value: true }
  }

  if (isBoolean(value.value)) {
    return { status: 'ok', value: value.value }
  }

  return { status: 'bad' }
}

function isStringList(value: readonly unknown[]): value is readonly string[] {
  return value.every(isString)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
