import { isNonEmptyString } from '@/core/guards'

/** Nonce-based app CSP. Without a nonce, scripts load from the origin only. */
export function buildAppCsp(isEvalAllowed: boolean, nonce?: string): string {
  return [
    "default-src 'self'",
    "connect-src 'self' ipc: http://ipc.localhost",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    scriptDirective(isEvalAllowed, nonce),
    "font-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

/** Tauri serves the splash page with this policy. It has no scripts. */
export const APP_CSP = buildAppCsp(false)

export const APP_CSP_DEV = buildAppCsp(true)

function scriptDirective(isEvalAllowed: boolean, nonce?: string): string {
  const parts = ["'self'"]

  if (isNonEmptyString(nonce)) {
    parts.push(`'nonce-${nonce}'`, "'strict-dynamic'")
  }

  if (isEvalAllowed) {
    parts.push("'unsafe-eval'")
  }

  return `script-src ${parts.join(' ')}`
}
