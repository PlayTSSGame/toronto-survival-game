import { defineConfig } from 'vitest/config'

// Separate config so the slow balance report never runs as part of `npm test`.
export default defineConfig({ test: { environment: 'node', include: ['scripts/balance.check.ts'], testTimeout: 600_000 } })
