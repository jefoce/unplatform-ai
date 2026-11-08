/* eslint-disable max-lines -- protocol schemas and type contracts stay in one suite */

import fs from 'node:fs'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

import { isRecord } from '../src/core/guards'
import {
  UPAI_ERROR_CODES,
  UPAI_JOB_KINDS,
  UPAI_JOB_STATUSES,
  UPAI_MODEL_STATUSES,
  UPAI_WAITING_ON,
  type UpaiCapabilities,
  UpaiCapabilitiesSchema,
  type UpaiCount,
  UpaiCountSchema,
  type UpaiCreatedJob,
  UpaiCreatedJobSchema,
  type UpaiDuration,
  UpaiDurationSchema,
  type UpaiError,
  type UpaiErrorCode,
  type UpaiErrorDetails,
  UpaiErrorDetailsSchema,
  type UpaiErrorResponse,
  UpaiErrorResponseSchema,
  UpaiErrorSchema,
  type UpaiFrameRule,
  UpaiFrameRuleSchema,
  type UpaiFrames,
  UpaiFramesSchema,
  type UpaiHealth,
  UpaiHealthSchema,
  type UpaiJob,
  type UpaiJobKind,
  type UpaiJobProgress,
  UpaiJobProgressSchema,
  UpaiJobSchema,
  type UpaiJobStatus,
  type UpaiJobUsage,
  UpaiJobUsageSchema,
  type UpaiModel,
  type UpaiModelList,
  UpaiModelListSchema,
  UpaiModelSchema,
  type UpaiModelStatus,
  type UpaiPricing,
  UpaiPricingSchema,
  type UpaiPrompt,
  UpaiPromptSchema,
  type UpaiReferenceCount,
  type UpaiReferenceCounts,
  UpaiReferenceCountSchema,
  UpaiReferenceCountsSchema,
  type UpaiReferenceLimit,
  type UpaiReferenceLimits,
  UpaiReferenceLimitSchema,
  UpaiReferenceLimitsSchema,
  type UpaiSizeMap,
  UpaiSizeMapSchema,
  type UpaiSyncImage,
  type UpaiSyncImages,
  UpaiSyncImageSchema,
  UpaiSyncImagesSchema,
  type UpaiUpload,
  UpaiUploadSchema,
  type UpaiWaitingOn,
  type UpaiWorkflow,
  UpaiWorkflowSchema,
} from '../src/core/protocol/upai'

type ProtocolTypes = readonly [
  UpaiCapabilities,
  UpaiCount,
  UpaiCreatedJob,
  UpaiDuration,
  UpaiError,
  UpaiErrorCode,
  UpaiErrorDetails,
  UpaiErrorResponse,
  UpaiFrameRule,
  UpaiFrames,
  UpaiHealth,
  UpaiJob,
  UpaiJobKind,
  UpaiJobProgress,
  UpaiJobStatus,
  UpaiJobUsage,
  UpaiModel,
  UpaiModelList,
  UpaiModelStatus,
  UpaiPricing,
  UpaiPrompt,
  UpaiReferenceCount,
  UpaiReferenceCounts,
  UpaiReferenceLimit,
  UpaiReferenceLimits,
  UpaiSizeMap,
  UpaiSyncImage,
  UpaiSyncImages,
  UpaiUpload,
  UpaiWaitingOn,
  UpaiWorkflow,
]

const CONTRACT_TYPES: ProtocolTypes | null = null

const ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const FIXTURES = path.join(ROOT, 'fixtures')
const SCHEMAS_DIR = path.join(ROOT, 'schema')
const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema'
const DEFS_PREFIX = '#/$defs/'

const EXPECTED_SCHEMAS = [
  'create-job.schema.json',
  'error.schema.json',
  'health.schema.json',
  'job.schema.json',
  'models.schema.json',
  'sync-images.schema.json',
  'upload.schema.json',
]

const EXPECTED_FIXTURES = [
  'README.md',
  'create-job-image.json',
  'create-job-video.json',
  'error-comfy_unavailable.json',
  'error-config_invalid.json',
  'error-forbidden.json',
  'error-internal.json',
  'error-invalid_request.json',
  'error-job_failed.json',
  'error-job_not_found.json',
  'error-method_not_allowed.json',
  'error-model_not_found.json',
  'error-not_found.json',
  'error-queue_full.json',
  'error-timeout.json',
  'error-too_large.json',
  'error-unauthorized.json',
  'error-upload_not_found.json',
  'error-workflow_invalid.json',
  'health.json',
  'job-cancelled.json',
  'job-completed.json',
  'job-expired.json',
  'job-failed.json',
  'job-in_progress.json',
  'job-pending.json',
  'models-image.json',
  'models-invalid.json',
  'models-video.json',
  'sync-images.json',
  'upload.json',
]

const FIXTURE_SCHEMAS: Record<string, ZodType> = {
  'create-job-image.json': UpaiCreatedJobSchema,
  'create-job-video.json': UpaiCreatedJobSchema,
  'error-comfy_unavailable.json': UpaiErrorResponseSchema,
  'error-config_invalid.json': UpaiErrorResponseSchema,
  'error-forbidden.json': UpaiErrorResponseSchema,
  'error-internal.json': UpaiErrorResponseSchema,
  'error-invalid_request.json': UpaiErrorResponseSchema,
  'error-job_failed.json': UpaiErrorResponseSchema,
  'error-job_not_found.json': UpaiErrorResponseSchema,
  'error-method_not_allowed.json': UpaiErrorResponseSchema,
  'error-model_not_found.json': UpaiErrorResponseSchema,
  'error-not_found.json': UpaiErrorResponseSchema,
  'error-queue_full.json': UpaiErrorResponseSchema,
  'error-timeout.json': UpaiErrorResponseSchema,
  'error-too_large.json': UpaiErrorResponseSchema,
  'error-unauthorized.json': UpaiErrorResponseSchema,
  'error-upload_not_found.json': UpaiErrorResponseSchema,
  'error-workflow_invalid.json': UpaiErrorResponseSchema,
  'health.json': UpaiHealthSchema,
  'job-cancelled.json': UpaiJobSchema,
  'job-completed.json': UpaiJobSchema,
  'job-expired.json': UpaiJobSchema,
  'job-failed.json': UpaiJobSchema,
  'job-in_progress.json': UpaiJobSchema,
  'job-pending.json': UpaiJobSchema,
  'models-image.json': UpaiModelListSchema,
  'models-invalid.json': UpaiModelListSchema,
  'models-video.json': UpaiModelListSchema,
  'sync-images.json': UpaiSyncImagesSchema,
  'upload.json': UpaiUploadSchema,
}

const ALL_SCHEMAS = [
  UpaiPromptSchema,
  UpaiReferenceCountSchema,
  UpaiReferenceCountsSchema,
  UpaiReferenceLimitSchema,
  UpaiReferenceLimitsSchema,
  UpaiFramesSchema,
  UpaiDurationSchema,
  UpaiFrameRuleSchema,
  UpaiSizeMapSchema,
  UpaiCountSchema,
  UpaiCapabilitiesSchema,
  UpaiWorkflowSchema,
  UpaiPricingSchema,
  UpaiModelSchema,
  UpaiModelListSchema,
  UpaiHealthSchema,
  UpaiJobProgressSchema,
  UpaiJobUsageSchema,
  UpaiJobSchema,
  UpaiErrorDetailsSchema,
  UpaiErrorSchema,
  UpaiErrorResponseSchema,
  UpaiUploadSchema,
  UpaiSyncImageSchema,
  UpaiSyncImagesSchema,
  UpaiCreatedJobSchema,
] as const

function readFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')) as unknown
}

/** Every `$ref` string in a schema, nested objects and arrays included. */
function localRefs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(localRefs)
  }

  if (!isRecord(value)) {
    return []
  }

  const own = isString(value.$ref) ? [value.$ref] : []

  return [...own, ...Object.values(value).flatMap(localRefs)]
}

const jsonFixtures = EXPECTED_FIXTURES.filter((name) => {
  return name.endsWith('.json')
})

describe('upai/1 schemas', () => {
  it('keeps the vendored fixture list', () => {
    const onDisk = fs
      .readdirSync(FIXTURES)
      .filter((name) => {
        return !name.startsWith('.')
      })
      .sort()

    expect(onDisk).toEqual(EXPECTED_FIXTURES)
  })

  it('maps every fixture to a schema', () => {
    expect(Object.keys(FIXTURE_SCHEMAS).sort()).toEqual(jsonFixtures)

    for (const name of Object.keys(FIXTURE_SCHEMAS)) {
      expect(fs.existsSync(path.join(FIXTURES, name))).toBe(true)
    }
  })

  it('parses every fixture with its schema', () => {
    for (const [name, schema] of Object.entries(FIXTURE_SCHEMAS)) {
      const result = schema.safeParse(readFixture(name))

      expect(result.success, name).toBe(true)
    }
  })

  it('pins the vendored source', () => {
    const source = fs.readFileSync(path.join(ROOT, 'SOURCE'), 'utf8')

    expect(source).toContain('repo: unplatform-ai-provider-node')
    expect(source).toContain('commit: 2a30d9e')
  })
})

describe('upai/1 json schemas', () => {
  it('keeps the vendored schema list', () => {
    const onDisk = fs
      .readdirSync(SCHEMAS_DIR)
      .filter((name) => {
        return !name.startsWith('.')
      })
      .sort()

    expect(onDisk).toEqual(EXPECTED_SCHEMAS)
  })

  it('parses every schema and resolves its local refs', () => {
    for (const name of EXPECTED_SCHEMAS) {
      const raw: unknown = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, name), 'utf8'))
      const schema: Record<string, unknown> = isRecord(raw) ? raw : {}

      expect(schema.$schema, name).toBe(DRAFT_2020_12)

      const defs = isRecord(schema.$defs) ? schema.$defs : {}

      for (const ref of localRefs(schema)) {
        expect(ref.startsWith(DEFS_PREFIX), `${name} -> ${ref}`).toBe(true)
        expect(Object.hasOwn(defs, ref.slice(DEFS_PREFIX.length)), `${name} -> ${ref}`).toBe(true)
      }
    }
  })
})

describe('upai/1 enums', () => {
  it('matches the error code list', () => {
    expect(UPAI_ERROR_CODES).toEqual([
      'invalid_request',
      'unauthorized',
      'forbidden',
      'config_invalid',
      'model_not_found',
      'job_not_found',
      'upload_not_found',
      'not_found',
      'method_not_allowed',
      'too_large',
      'workflow_invalid',
      'queue_full',
      'comfy_unavailable',
      'job_failed',
      'internal',
      'timeout',
    ])

    for (const name of jsonFixtures) {
      if (!name.startsWith('error-')) {
        continue
      }

      const parsed = UpaiErrorResponseSchema.parse(readFixture(name))

      expect(UPAI_ERROR_CODES).toContain(parsed.error.code)
    }
  })

  it('matches the enum lists', () => {
    for (const name of jsonFixtures.filter((fixture) => {
      return fixture.startsWith('job-')
    })) {
      const job = UpaiJobSchema.parse(readFixture(name))

      expect(UPAI_JOB_STATUSES).toContain(job.status)
      expect(UPAI_JOB_KINDS).toContain(job.kind)

      const waitingOn = job.progress?.waiting_on

      if (!isNil(waitingOn)) {
        expect(UPAI_WAITING_ON).toContain(waitingOn)
      }
    }

    for (const name of jsonFixtures.filter((fixture) => {
      return fixture.startsWith('models-')
    })) {
      const list = UpaiModelListSchema.parse(readFixture(name))

      for (const model of list.data) {
        expect(UPAI_MODEL_STATUSES).toContain(model.status)
        expect(UPAI_JOB_KINDS).toContain(model.kind)
      }
    }
  })

  it('exports every schema', () => {
    for (const schema of ALL_SCHEMAS) {
      expect(typeof schema.safeParse).toBe('function')
    }
  })

  it('exports every contract type', () => {
    expect(CONTRACT_TYPES).toBeNull()
  })
})
