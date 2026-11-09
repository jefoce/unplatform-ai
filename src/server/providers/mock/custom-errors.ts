import 'server-only'

import type { UpaiError } from '@/core/protocol/upai'

import { ProviderError, type ProviderErrorKind } from '../provider-error'
import { customMockFixtures } from './custom-fixtures'

const ERROR_KINDS: Partial<Record<string, ProviderErrorKind>> = {
  comfy_unavailable: 'timeout',
  workflow_invalid: 'server',
  model_not_found: 'input',
  job_failed: 'server',
}

const ERROR_STATUS: Partial<Record<string, number>> = {
  comfy_unavailable: 0,
  workflow_invalid: 422,
  model_not_found: 404,
  job_failed: 502,
}

/** Raw `upai:<code>: <message>` text, the shape the custom adapters store. */
function customMockError(error: UpaiError): ProviderError {
  const message = `upai:${error.code}: ${error.message}`

  return new ProviderError({
    providerId: 'custom',
    kind: ERROR_KINDS[error.code] ?? 'server',
    message,
    storedMessage: message,
    status: ERROR_STATUS[error.code] ?? 500,
    code: error.code,
  })
}

export function customMockUnavailableError(): ProviderError {
  return customMockError(customMockFixtures().errors.unavailable)
}

export function customMockWorkflowInvalidError(): ProviderError {
  return customMockError(customMockFixtures().errors.workflowInvalid)
}

export function customMockJobFailedError(): ProviderError {
  return customMockError(customMockFixtures().errors.jobFailed)
}
