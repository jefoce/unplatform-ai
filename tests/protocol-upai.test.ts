import fs from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

import {
  UPAI_ERROR_CODES,
  UPAI_JOB_KINDS,
  UPAI_JOB_STATUSES,
  UPAI_MODEL_STATUSES,
  UPAI_WAITING_ON,
  UpaiCapabilitiesSchema,
  UpaiCountSchema,
  UpaiCreatedJobSchema,
  UpaiDurationSchema,
  UpaiErrorDetailsSchema,
  UpaiErrorResponseSchema,
  UpaiErrorSchema,
  UpaiFrameRuleSchema,
  UpaiFramesSchema,
  UpaiHealthSchema,
  UpaiJobProgressSchema,
  UpaiJobSchema,
  UpaiJobUsageSchema,
  UpaiModelListSchema,
  UpaiModelSchema,
  UpaiPricingSchema,
  UpaiPromptSchema,
  UpaiReferenceCountSchema,
  UpaiReferenceCountsSchema,
  UpaiReferenceLimitSchema,
  UpaiReferenceLimitsSchema,
  UpaiSizeMapSchema,
  UpaiSyncImageSchema,
  UpaiSyncImagesSchema,
  UpaiUploadSchema,
  UpaiWorkflowSchema,
} from '../src/core/protocol/upai'

const ROOT = path.join(process.cwd(), 'docs/protocol/upai-1')
const FIXTURES = path.join(ROOT, 'fixtures')

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
})
