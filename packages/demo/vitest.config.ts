import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests acquire their fixtures with `using`, which Oxc would otherwise
  // downlevel to a helper that isn't a dependency.
  oxc: { target: 'esnext' },
  test: {
    name: 'demo',
    globals: true,
    silent: 'passed-only',
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.dist.test.ts'],
          typecheck: { enabled: true },
        },
      },
      {
        // Serves the built site, so the tests load its pages as deployed.
        publicDir: 'dist',
        test: {
          name: 'dist',
          include: ['**/*.dist.test.ts'],
          exclude: [...configDefaults.exclude],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            viewport: { width: 800, height: 600 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
