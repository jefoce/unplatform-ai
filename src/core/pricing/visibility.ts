interface PriceSourceInfo {
  local: boolean
}

/** A local model at 0 hides its price. An API model at 0 still shows "$0.00". */
export function showPrice(source: PriceSourceInfo, usd: number): boolean {
  return !source.local || usd > 0
}
