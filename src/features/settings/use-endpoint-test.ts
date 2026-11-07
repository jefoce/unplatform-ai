'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'

import { messageOf } from '@/core/errors'
import { type EndpointTestResult, testEndpoint } from '@/lib/api/endpoints'

import type { EndpointRowDraft } from './endpoint-draft'

interface UseEndpointTestParams {
  rows: EndpointRowDraft[]
  onResult: (key: string, result: EndpointTestResult) => void
}

export interface EndpointTestState {
  testingKey: string | null
  onTest: (key: string) => void
}

function tokenFor(row: EndpointRowDraft): string | null | undefined {
  if (row.isTokenRemoved) {
    return null
  }

  const value = row.tokenValue.trim()

  if (value === '') {
    return undefined
  }

  return value
}

function failedTest(message: string): EndpointTestResult {
  return {
    ok: false,
    error: message,
    protocol: null,
    serverVersion: null,
    videoCount: 0,
    imageCount: 0,
    authRequired: null,
    lanAllowed: null,
    instanceId: null,
    maxRunning: null,
    lastHealth: null,
  }
}

/** One inline test at a time, keyed by row. */
export function useEndpointTest(params: UseEndpointTestParams): EndpointTestState {
  const { rows } = params
  const [testingKey, setTestingKey] = useState<string | null>(null)

  const testRow = async (key: string): Promise<void> => {
    const row = rows.find((item) => {
      return item.key === key
    })

    if (isNil(row)) {
      return
    }

    setTestingKey(key)

    try {
      const token = tokenFor(row)

      const result = await testEndpoint({
        baseUrl: row.baseUrl,
        endpointId: row.id,
        token,
      })

      params.onResult(key, result)
    } catch (error) {
      params.onResult(key, failedTest(messageOf(error, 'Test failed')))
    } finally {
      setTestingKey(null)
    }
  }

  const onTest = (key: string) => {
    void testRow(key)
  }

  return { testingKey, onTest }
}
