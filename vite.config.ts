import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    port: 3000,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
