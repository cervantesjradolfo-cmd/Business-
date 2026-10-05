import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Tests live next to the code they cover as *.test.ts / *.test.tsx.
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }),
)
