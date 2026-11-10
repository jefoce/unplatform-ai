import type { NextConfig } from 'next'

import packageJson from './package.json'

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ['sharp', '@napi-rs/keyring'],
  outputFileTracingExcludes: {
    '*': [
      '.e2e-tmp/**',
      '**/*.map',
      '**/*.d.ts',
      '**/*.d.mts',
      '**/*.d.cts',
      '**/node_modules/@img/sharp-linux-*/**',
      '**/node_modules/@img/sharp-win32-*/**',
      '**/node_modules/@img/sharp-darwin-x64/**',
      '**/node_modules/@napi-rs/keyring-linux-*/**',
      '**/node_modules/@napi-rs/keyring-win32-*/**',
      '**/node_modules/next/dist/compiled/@vercel/og/**',
      '**/node_modules/next/dist/compiled/edge-runtime/**',
      '**/node_modules/next/dist/compiled/@mswjs/**',
      '**/node_modules/next/dist/compiled/tar/**',
      '**/node_modules/next/dist/compiled/next-server/*experimental*',
      '**/node_modules/**/test/**',
      '**/node_modules/**/tests/**',
      '**/node_modules/**/__tests__/**',
      '**/node_modules/**/docs/**',
      '**/node_modules/**/examples/**',
      '**/node_modules/**/benchmark/**',
      '**/node_modules/**/benchmarks/**',
    ],
  },
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]

    return [
      { source: '/:path*', headers: common },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}
export default nextConfig
