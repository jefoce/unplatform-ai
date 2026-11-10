import 'server-only'

import type { EndpointTestResult } from '@/core/api/endpoints'
import type { UpaiHealth } from '@/core/protocol/upai'
import {
  type CustomEndpointLastHealth,
  CustomEndpointLastHealthSchema,
} from '@/core/schemas/custom-endpoint'

import { customMockFixtures } from '../providers/mock/custom-fixtures'
import { customMockCatalogForInstance } from '../providers/mock/custom-mock'
import { recordHealthFailure, recordHealthOk } from './endpoint-health'

const OFFLINE_TEXT = 'Start ComfyUI, then test again'

export function lastHealthOf(health: UpaiHealth, checkedAt: string): CustomEndpointLastHealth {
  return CustomEndpointLastHealthSchema.parse({
    protocol: health.protocol,
    serverVersion: health.server_version,
    maxRunning: health.max_running,
    lanAllowed: health.lan_allowed,
    authRequired: health.auth_required,
    maxUploadBytes: health.max_upload_bytes,
    resultDelete: health.result_delete === true,
    checkedAt,
  })
}

/** In-process endpoint test for one demo instance, with no network call. */
export function mockTestResult(endpointId: string): EndpointTestResult {
  const catalog = customMockCatalogForInstance(endpointId)
  const health = customMockFixtures().health
  const checkedAt = new Date().toISOString()

  if (!catalog.isReachable) {
    recordHealthFailure({ endpointId, status: 'unreachable', message: OFFLINE_TEXT })

    return {
      ok: false,
      error: OFFLINE_TEXT,
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

  recordHealthOk(endpointId, health.max_running)

  return {
    ok: true,
    error: null,
    serverVersion: health.server_version,
    videoCount: catalog.video.length,
    imageCount: catalog.image.length,
    authRequired: health.auth_required,
    lanAllowed: health.lan_allowed,
    instanceId: endpointId,
    lastHealth: lastHealthOf(health, checkedAt),
    warnings: [],
  }
}
