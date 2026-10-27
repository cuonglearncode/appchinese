import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 15000
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared')
    }
  }
})
