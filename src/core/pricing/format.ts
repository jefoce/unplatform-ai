export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatEstimate(value: number): string {
  return `\u2248 ${formatUsd(value)}`
}

export function formatRate(value: number): string {
  const decimals = Math.round(value * 1000) % 10 === 0 ? 2 : 3

  return `$${value.toFixed(decimals)}/s`
}
