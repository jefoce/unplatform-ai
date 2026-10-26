import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { SecretName } from '@/core/secret-names'
import type { TestResult } from '@/core/types'

import { getSecret } from '../secrets'
import { createS3Store, type S3StoreConfig } from './s3-store'

const MISSING_ORDER: readonly SecretName[] = [
  'R2_BUCKET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
]

/** R2 endpoint and credentials, or null when a secret is missing. */
export function r2Config(): S3StoreConfig | null {
  const bucket = getSecret('R2_BUCKET')
  const accountId = getSecret('R2_ACCOUNT_ID')
  const accessKeyId = getSecret('R2_ACCESS_KEY_ID')
  const secretAccessKey = getSecret('R2_SECRET_ACCESS_KEY')

  if (
    !isNonEmptyString(bucket) ||
    !isNonEmptyString(accountId) ||
    !isNonEmptyString(accessKeyId) ||
    !isNonEmptyString(secretAccessKey)
  ) {
    return null
  }

  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
  }
}

/** Writes, reads and deletes a 4-byte probe. Returns the S3 error code on failure. */
export async function testR2(): Promise<TestResult> {
  const config = r2Config()

  if (isNil(config)) {
    const missing = MISSING_ORDER.find((name) => {
      return !isNonEmptyString(getSecret(name))
    })

    return { ok: false, error: `${missing ?? 'R2_BUCKET'} is not set` }
  }

  return createS3Store(config).testConnection()
}
