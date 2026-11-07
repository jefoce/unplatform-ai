'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'
import useSWR from 'swr'

import {
  type EndpointOverview,
  ENDPOINTS_KEY,
  type EndpointTestResult,
  fetchEndpoints,
  saveEndpoints,
} from '@/lib/api/endpoints'

import {
  type EndpointRowDraft,
  type EndpointRowPatch,
  type EndpointsDraft,
  isDraftValid,
  nextFreeBadge,
  toInput,
  toRow,
} from './endpoint-draft'
import { useEndpointTest } from './use-endpoint-test'

let rowSequence = 0

interface UseEndpointsDraftParams {
  isOpen: boolean
}

interface TestResultParams {
  rows: EndpointRowDraft[]
  key: string
  result: EndpointTestResult
}

function newRowKey(): string {
  rowSequence += 1

  return `draft-${rowSequence}`
}

function seedRows(data: EndpointOverview | undefined): EndpointRowDraft[] {
  if (isNil(data)) {
    return []
  }

  return data.endpoints.map((endpoint) => {
    return toRow(endpoint)
  })
}

function newRow(rows: EndpointRowDraft[], nextBadge: string): EndpointRowDraft {
  return {
    key: newRowKey(),
    id: null,
    label: '',
    badge: nextFreeBadge(rows, nextBadge),
    baseUrl: '',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    videoCount: 0,
    imageCount: 0,
    runningJobs: 0,
    status: 'unknown',
    tokenValue: '',
    isTokenRemoved: false,
    hasToken: false,
    tokenHint: null,
    isExpanded: true,
    isRemoved: false,
    isTesting: false,
    test: null,
  }
}

function withTestResult(params: TestResultParams): EndpointRowDraft[] {
  const { rows, key, result } = params

  return rows.map((row) => {
    if (row.key !== key) {
      return row
    }

    if (!result.ok) {
      return { ...row, test: result, status: 'unreachable' }
    }

    return {
      ...row,
      test: result,
      status: 'ok',
      lastHealth: result.lastHealth,
      instanceId: result.instanceId,
      videoCount: result.videoCount,
      imageCount: result.imageCount,
    }
  })
}

/** Local endpoint draft. Nothing is written until Save. */
export function useEndpointsDraft(params: UseEndpointsDraftParams): EndpointsDraft {
  const { isOpen } = params
  const swrKey = isOpen ? ENDPOINTS_KEY : null

  const { data } = useSWR<EndpointOverview>(swrKey, fetchEndpoints, {
    revalidateOnFocus: false,
  })

  const [rows, setRows] = useState<EndpointRowDraft[] | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const currentRows = rows ?? seedRows(data)
  const nextBadge = data?.nextBadge ?? 'CU1'

  const applyResult = (key: string, result: EndpointTestResult) => {
    setRows((current) => {
      return withTestResult({ rows: current ?? seedRows(data), key, result })
    })

    if (result.ok) {
      setIsDirty(true)
    }
  }

  const test = useEndpointTest({ rows: currentRows, onResult: applyResult })

  const onAdd = () => {
    setRows([...currentRows, newRow(currentRows, nextBadge)])
    setIsDirty(true)
  }

  const onChange = (key: string, patch: EndpointRowPatch) => {
    setRows(
      currentRows.map((row) => {
        if (row.key !== key) {
          return row
        }

        return { ...row, ...patch }
      }),
    )

    setIsDirty(true)
  }

  const onSave = async (): Promise<void> => {
    const kept = currentRows.filter((row) => {
      return !row.isRemoved
    })

    const next = await saveEndpoints({
      endpoints: kept.map((row) => {
        return toInput(row)
      }),
    })

    setRows(next.endpoints.map(toRow))
    setIsDirty(false)
  }

  const reset = () => {
    setRows(null)
    setIsDirty(false)
  }

  return {
    rows: currentRows.map((row) => {
      return { ...row, isTesting: test.testingKey === row.key }
    }),
    nextBadge,
    isLoading: isNil(rows) && isNil(data),
    isDirty,
    isValid: isDraftValid(currentRows),
    onAdd,
    onChange,
    onTest: test.onTest,
    onSave,
    reset,
  }
}
