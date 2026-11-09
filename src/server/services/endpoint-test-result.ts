import 'server-only'

import { uniq } from 'lodash-es'

import type { EndpointTestResult } from '@/core/api/endpoints'
import { mapCustomModel } from '@/core/presets/custom/from-capabilities'
import type { UpaiHealth, UpaiModel } from '@/core/protocol/upai'
import type { CustomEndpoint, CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'

interface WarningParams {
  endpointId: string | null
  baseUrl: string
  health: UpaiHealth
  video: readonly UpaiModel[]
  image: readonly UpaiModel[]
}

/** Unique mapper warnings from both lists, so the form can show them with the counts. */
function mappingWarnings(params: WarningParams): string[] {
  const { endpointId, baseUrl, health, video, image } = params

  const endpoint: CustomEndpoint = {
    id: endpointId ?? 'draft',
    label: 'Endpoint test',
    badge: 'TST',
    baseUrl,
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
  }

  const warnings = [...video, ...image].flatMap((model) => {
    return mapCustomModel({
      endpoint,
      model,
      maxUploadBytes: health.max_upload_bytes,
    }).warnings
  })

  return uniq(warnings)
}

interface TestSucceededParams extends WarningParams {
  lastHealth: CustomEndpointLastHealth
}

/** Successful test result with health facts, counts and mapper warnings. */
export function testSucceeded(params: TestSucceededParams): EndpointTestResult {
  const { endpointId, baseUrl, health, video, image, lastHealth } = params

  return {
    ok: true,
    error: null,
    serverVersion: health.server_version,
    videoCount: video.length,
    imageCount: image.length,
    authRequired: health.auth_required,
    lanAllowed: health.lan_allowed,
    instanceId: instanceIdOf(health.instance_id),
    lastHealth,
    warnings: mappingWarnings({ endpointId, baseUrl, health, video, image }),
  }
}

function instanceIdOf(value: string): string | null {
  if (value === '') {
    return null
  }

  return value
}

/** Uniform failure result, also used by the client-side early failure path. */
export function testFailed(message: string): EndpointTestResult {
  return {
    ok: false,
    error: message,
    serverVersion: null,
    videoCount: 0,
    imageCount: 0,
    authRequired: null,
    lanAllowed: null,
    instanceId: null,
    lastHealth: null,
    warnings: [],
  }
}
