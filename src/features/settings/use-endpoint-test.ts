'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'

import type { EndpointTestResult } from '@/core/api/endpoints'
import { messageOf } from '@/core/errors'
import { testEndpoint } from '@/lib/api/endpoints'

import { type EndpointRowDraft, type TestedEndpoint, tokenOf } from './endpoint-draft'

export interface EndpointTestOutcome {
  key: string
  tested: TestedEndpoint
  result: EndpointTestResult
}

interface UseEndpointTestParams {
  rows: EndpointRowDraft[]
  onResult: (outcome: EndpointTestOutcome) => void
}

export interface EndpointTestState {
  testingKey: string | null
  onTest: (key: string) => void
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

    const tested = { baseUrl: row.baseUrl, token: tokenOf(row) }

    try {
      const result = await testEndpoint({
        baseUrl: tested.baseUrl,
        endpointId: row.id,
        token: tested.token,
      })

      params.onResult({ key, tested, result })
    } catch (error) {
      params.onResult({ key, tested, result: failedTest(messageOf(error, 'Test failed')) })
    } finally {
      setTestingKey(null)
    }
  }

  const onTest = (key: string) => {
    void testRow(key)
  }

  return { testingKey, onTest }
}
