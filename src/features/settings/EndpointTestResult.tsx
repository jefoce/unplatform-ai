'use client'

import { isNil } from 'lodash-es'

import type { EndpointTestResult as EndpointTestData } from '@/core/api/endpoints'

interface EndpointTestResultProps {
  test: EndpointTestData | null
}

/** Inline health and model list result under one endpoint form. */
export function EndpointTestResult(props: EndpointTestResultProps) {
  const { test } = props

  if (isNil(test)) {
    return null
  }

  if (!test.ok) {
    return <p className="text-xs text-danger">{test.error ?? 'Test failed'}</p>
  }

  const lanText = test.lanAllowed === true ? 'on' : 'off'
  const tokenText = test.authRequired === true ? 'Token required' : 'No token needed'

  return (
    <ul className="space-y-0.5 text-xs text-fg-2">
      {!isNil(test.lastHealth) && <li>Protocol upai/{test.lastHealth.protocol}</li>}
      <li>ComfyUI {test.serverVersion}</li>
      <li>
        {test.videoCount} video, {test.imageCount} image models
      </li>
      {test.warnings.map((warning) => {
        return (
          <li key={warning} className="text-amber">
            {warning}
          </li>
        )
      })}
      <li>LAN access {lanText}</li>
      <li>{tokenText}</li>
    </ul>
  )
}
