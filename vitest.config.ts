import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // test files share one database, so they run one after another
    fileParallelism: false,
  },
})
