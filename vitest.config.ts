import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: process.env.CI ? 20_000 : 5_000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      'server-only': new URL('./tests/stubs/empty.ts', import.meta.url).pathname,
    },
  },
})
