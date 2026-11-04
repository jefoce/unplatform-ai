import type { PricingConfig } from '../../pricing/types'
import type { ProviderId } from '../../providers/types'
import type { TransportByKind } from './transport'

/** Fields every model binding shares, video or image. */
export interface BindingBase {
  provider: ProviderId
  modelId: string
  pricing: PricingConfig
}

export interface ProviderBinding extends BindingBase {
  transport: TransportByKind
}
