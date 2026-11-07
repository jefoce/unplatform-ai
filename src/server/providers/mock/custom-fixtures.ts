import 'server-only'

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ZodType } from 'zod'

import {
  type UpaiError,
  UpaiErrorResponseSchema,
  type UpaiHealth,
  UpaiHealthSchema,
  type UpaiJob,
  UpaiJobSchema,
  type UpaiModel,
  UpaiModelListSchema,
} from '@/core/protocol/upai'

const FIXTURES_DIR = path.join(process.cwd(), 'docs/protocol/upai-1/fixtures')

interface CustomMockJobs {
  pending: UpaiJob
  inProgress: UpaiJob
  completed: UpaiJob
  failed: UpaiJob
  cancelled: UpaiJob
}

interface CustomMockErrors {
  unavailable: UpaiError
  workflowInvalid: UpaiError
  modelNotFound: UpaiError
  jobFailed: UpaiError
}

export interface CustomMockFixtures {
  health: UpaiHealth
  videoModels: readonly UpaiModel[]
  imageModels: readonly UpaiModel[]
  invalidModels: readonly UpaiModel[]
  jobs: CustomMockJobs
  errors: CustomMockErrors
}

let cache: CustomMockFixtures | null = null

/** Fixtures are read once per process, only when the mock adapter is used. */
export function customMockFixtures(): CustomMockFixtures {
  if (cache) {
    return cache
  }

  cache = loadFixtures()

  return cache
}

function loadFixtures(): CustomMockFixtures {
  return {
    health: readFixture(UpaiHealthSchema, 'health.json'),
    videoModels: readModels('models-video.json'),
    imageModels: readModels('models-image.json'),
    invalidModels: readModels('models-invalid.json'),
    jobs: {
      pending: readJob('job-pending.json'),
      inProgress: readJob('job-in_progress.json'),
      completed: readJob('job-completed.json'),
      failed: readJob('job-failed.json'),
      cancelled: readJob('job-cancelled.json'),
    },
    errors: {
      unavailable: readError('error-comfy_unavailable.json'),
      workflowInvalid: readError('error-workflow_invalid.json'),
      modelNotFound: readError('error-model_not_found.json'),
      jobFailed: readError('error-job_failed.json'),
    },
  }
}

function readFixture<T>(schema: ZodType<T>, file: string): T {
  const text = readFileSync(path.join(FIXTURES_DIR, file), 'utf8')
  const raw: unknown = JSON.parse(text)

  return schema.parse(raw)
}

function readModels(file: string): readonly UpaiModel[] {
  return readFixture(UpaiModelListSchema, file).data
}

function readJob(file: string): UpaiJob {
  return readFixture(UpaiJobSchema, file)
}

function readError(file: string): UpaiError {
  return readFixture(UpaiErrorResponseSchema, file).error
}
