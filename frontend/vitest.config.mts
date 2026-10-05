import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias declared in tsconfig.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright owns tests/smoke.spec.ts — keep the two runners separate.
    exclude: ['node_modules/**', '.next/**', 'tests/**', 'e2e/**'],
  },
})
