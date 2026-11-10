import fs from 'node:fs'
import path from 'node:path'

import Ajv2020, { type AnySchema } from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const SCHEMA_DIR = path.join(ROOT, 'schema')
const FIXTURE_DIR = path.join(ROOT, 'fixtures')

const EXPECTED_SCHEMAS = [
  'create-job.schema.json',
  'error.schema.json',
  'health.schema.json',
  'job.schema.json',
  'models.schema.json',
  'sync-images.schema.json',
  'upload.schema.json',
] as const

type SchemaName = (typeof EXPECTED_SCHEMAS)[number]

const SCHEMA_BY_PREFIX = {
  'create-job': 'create-job.schema.json',
  error: 'error.schema.json',
  health: 'health.schema.json',
  job: 'job.schema.json',
  models: 'models.schema.json',
  'sync-images': 'sync-images.schema.json',
  upload: 'upload.schema.json',
} as const

const PREFIXES = Object.keys(SCHEMA_BY_PREFIX).sort((left, right) => {
  return right.length - left.length
}) as (keyof typeof SCHEMA_BY_PREFIX)[]

function readJson(file: string): AnySchema {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AnySchema
}

function schemaFileFor(fixture: string): SchemaName {
  const name = fixture.slice(0, -'.json'.length)

  const prefix = PREFIXES.find((candidate) => {
    return name === candidate || name.startsWith(`${candidate}-`)
  })

  if (prefix === undefined) {
    throw new Error(`No schema mapped for ${fixture}`)
  }

  return SCHEMA_BY_PREFIX[prefix]
}

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })

const validators = new Map(
  EXPECTED_SCHEMAS.map((name) => {
    return [name, ajv.compile(readJson(path.join(SCHEMA_DIR, name)))] as const
  }),
)

function validatorFor(schemaName: SchemaName) {
  const validate = validators.get(schemaName)

  if (validate === undefined) {
    throw new Error(`Compiled no validator for ${schemaName}`)
  }

  return validate
}

const fixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => {
    return name.endsWith('.json')
  })
  .sort()

describe('upai/1 Draft 2020-12 validation', () => {
  it('keeps the expected schema files', () => {
    const onDisk = fs.readdirSync(SCHEMA_DIR).sort()

    expect(onDisk).toEqual([...EXPECTED_SCHEMAS])
  })

  it.each(fixtures)('validates %s against its schema', (fixture) => {
    const validate = validatorFor(schemaFileFor(fixture))
    const document = readJson(path.join(FIXTURE_DIR, fixture))

    expect(validate(document), JSON.stringify(validate.errors)).toBe(true)
  })
})
