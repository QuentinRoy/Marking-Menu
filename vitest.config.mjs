import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Test files are being migrated from .js to .ts; match both until the
    // migration completes.
    include: ['src/**/*.test.{js,ts}'],
    // Run the type level tests (`*.test-d.ts`) alongside the runtime ones.
    typecheck: { enabled: true },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      // Type level tests hold no runtime code to cover, and the default
      // exclusions do not cover the `.test-d.` infix.
      exclude: [...coverageConfigDefaults.exclude, '**/*.test-d.{js,ts}'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
