import type { PricingConfig } from '../../pricing/types'
import type { ProviderKindId } from '../../providers/types'
import type { TransportByKind } from './transport'

/** Fields every model binding shares, video or image. */
export interface BindingBase {
  provider: ProviderKindId
  modelId: string
  pricing: PricingConfig
}

export interface ProviderBinding extends BindingBase {
  transport: TransportByKind
}
