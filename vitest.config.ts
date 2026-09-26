import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      // Matched against each project's root. Only the library has a `src`
      // folder, so coverage covers the library alone.
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
