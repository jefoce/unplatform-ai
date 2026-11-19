import 'server-only'

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

import errorComfyUnavailableFixture from '../../../../docs/protocol/upai-1/fixtures/error-comfy_unavailable.json'
import errorJobFailedFixture from '../../../../docs/protocol/upai-1/fixtures/error-job_failed.json'
import errorModelNotFoundFixture from '../../../../docs/protocol/upai-1/fixtures/error-model_not_found.json'
import errorWorkflowInvalidFixture from '../../../../docs/protocol/upai-1/fixtures/error-workflow_invalid.json'
import healthFixture from '../../../../docs/protocol/upai-1/fixtures/health.json'
import jobCancelledFixture from '../../../../docs/protocol/upai-1/fixtures/job-cancelled.json'
import jobCompletedFixture from '../../../../docs/protocol/upai-1/fixtures/job-completed.json'
import jobFailedFixture from '../../../../docs/protocol/upai-1/fixtures/job-failed.json'
import jobInProgressFixture from '../../../../docs/protocol/upai-1/fixtures/job-in_progress.json'
import jobPendingFixture from '../../../../docs/protocol/upai-1/fixtures/job-pending.json'
import imageModelsFixture from '../../../../docs/protocol/upai-1/fixtures/models-image.json'
import invalidModelsFixture from '../../../../docs/protocol/upai-1/fixtures/models-invalid.json'
import videoModelsFixture from '../../../../docs/protocol/upai-1/fixtures/models-video.json'

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
    health: readFixture(UpaiHealthSchema, healthFixture),
    videoModels: readModels(videoModelsFixture),
    imageModels: readModels(imageModelsFixture),
    invalidModels: readModels(invalidModelsFixture),
    jobs: {
      pending: readJob(jobPendingFixture),
      inProgress: readJob(jobInProgressFixture),
      completed: readJob(jobCompletedFixture),
      failed: readJob(jobFailedFixture),
      cancelled: readJob(jobCancelledFixture),
    },
    errors: {
      unavailable: readError(errorComfyUnavailableFixture),
      workflowInvalid: readError(errorWorkflowInvalidFixture),
      modelNotFound: readError(errorModelNotFoundFixture),
      jobFailed: readError(errorJobFailedFixture),
    },
  }
}

function readFixture<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

function readModels(data: unknown): readonly UpaiModel[] {
  return readFixture(UpaiModelListSchema, data).data
}

function readJob(data: unknown): UpaiJob {
  return readFixture(UpaiJobSchema, data)
}

function readError(data: unknown): UpaiError {
  return readFixture(UpaiErrorResponseSchema, data).error
}
