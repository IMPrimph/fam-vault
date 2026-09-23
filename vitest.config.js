import { defineConfig } from 'vitest/config'

// Pure-logic tests only (src/lib). Kept separate from vite.config.js so the
// PWA and asset-copy plugins don't run under the test runner.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
})
