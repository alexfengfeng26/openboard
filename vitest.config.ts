import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'node',
        include: ['**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 60,
                functions: 60,
            },
        },
        exclude: ['node_modules', '.next', 'dist', 'build'],
    },
})
