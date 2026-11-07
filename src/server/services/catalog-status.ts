import 'server-only'

import { isNil } from 'lodash-es'

import type { ModelStatus } from '@/core/catalog'
import type { BindingBase } from '@/core/presets/common/binding'
import type { ProviderKindId } from '@/core/providers/types'

import { globalState } from '../global-state'
import type { EndpointSignal } from '../providers/types'

interface CatalogModel {
  modelId: string
}

interface CatalogList<TModel extends CatalogModel> {
  models: readonly TModel[]
  isFresh: boolean
}

interface CatalogProvider<TModel extends CatalogModel> {
  readonly id: ProviderKindId
  listModels(): Promise<CatalogList<TModel>>
  listEndpoints(modelId: string): Promise<EndpointSignal>
}

interface CatalogStatusParams<TModel extends CatalogModel> {
  provider: CatalogProvider<TModel>
  binding: BindingBase
  label: string
}

export interface CatalogStatus<TModel extends CatalogModel> {
  status: Exclude<ModelStatus, 'no_provider'>
  model: TModel | null
  reason: string | null
}

const warnings = globalState<Set<string>>('catalogStatusWarnings', () => {
  return new Set<string>()
})

/**
 * Availability from the model list and the endpoint listing.
 * Capability drift never decides availability.
 */
export async function catalogStatus<TModel extends CatalogModel>(
  params: CatalogStatusParams<TModel>,
): Promise<CatalogStatus<TModel>> {
  const { provider, binding, label } = params
  const { models, isFresh } = await provider.listModels()

  if (!isFresh) {
    warnOnce({ provider: provider.id, modelId: binding.modelId, reason: 'model list incomplete' })

    return { status: 'unverified', model: null, reason: null }
  }

  const model = models.find((item) => {
    return item.modelId === binding.modelId
  })

  if (!isNil(model)) {
    return { status: 'available', model, reason: null }
  }

  const endpoints = await provider.listEndpoints(binding.modelId)

  if (endpoints.state === 'not_found') {
    return {
      status: 'missing',
      model: null,
      reason: `Not available on ${label} right now.`,
    }
  }

  warnOnce({
    provider: provider.id,
    modelId: binding.modelId,
    reason: endpoints.reason ?? 'endpoints unavailable',
  })

  return { status: 'unverified', model: null, reason: null }
}

interface WarnParams {
  provider: ProviderKindId
  modelId: string
  reason: string
}

function warnOnce(params: WarnParams): void {
  const { provider, modelId, reason } = params
  const key = `${provider}:${modelId}`

  if (warnings.has(key)) {
    return
  }

  warnings.add(key)
  console.warn(`[model-catalog] ${modelId} unverified: ${reason}`)
}
