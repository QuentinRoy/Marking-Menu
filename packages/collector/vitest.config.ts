import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests acquire their fixtures with `using`, which Oxc would otherwise
  // downlevel to a helper that isn't a dependency.
  oxc: { target: 'esnext' },
  test: {
    name: 'collector',
    globals: true,
    silent: 'passed-only',
    projects: [
      {
        extends: true,
        test: {
          name: 'collector (unit)',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'collector (browser)',
          include: ['**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
