import type { NextConfig } from 'next'

import packageJson from './package.json'

/**
 * CSP for the app page. Next bootstrap styles and the OS_SCRIPT inline script
 * need 'unsafe-inline'. Tauri 2 IPC needs `ipc:` and `http://ipc.localhost`,
 * which Tauri cannot add itself because it owns no CSP in tauri.conf.json.
 * Dev needs 'unsafe-eval' for React 19 tooling, production does not.
 */
function buildAppCsp(isEvalAllowed: boolean): string {
  const scriptSrc = isEvalAllowed
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'"

  return [
    "default-src 'self'",
    "connect-src 'self' ipc: http://ipc.localhost",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export const APP_CSP = buildAppCsp(false)
export const APP_CSP_DEV = buildAppCsp(true)

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ['sharp', '@napi-rs/keyring'],
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]

    const appCsp = process.env.NODE_ENV === 'production' ? APP_CSP : APP_CSP_DEV

    return [
      { source: '/:path*', headers: common },
      {
        source: '/',
        headers: [{ key: 'Content-Security-Policy', value: appCsp }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
      },
    ]
  },
}
export default nextConfig
