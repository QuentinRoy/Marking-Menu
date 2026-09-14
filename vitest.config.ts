import { playwright } from '@vitest/browser-playwright';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';

// `ctx.page` is the orchestrator page holding the test iframe. Its mouse
// coordinates are relative to that page, not the iframe, so this adds the
// iframe's own on-page offset back in. The iframe is unscaled outside UI
// mode, which is all this project runs in.
const iframeOrigin: BrowserCommand<never[], { x: number; y: number }> = async (
  ctx,
) => {
  const box = await ctx.iframe.owner().boundingBox();
  if (!box) {
    throw new Error('The test iframe has no bounding box.');
  }

  return box;
};

const mouseMove: BrowserCommand<
  [x: number, y: number, steps?: number]
> = async (ctx, x, y, steps) => {
  const origin = await iframeOrigin(ctx);
  await ctx.page.mouse.move(
    origin.x + x,
    origin.y + y,
    steps === undefined ? undefined : { steps },
  );
};

const mouseDown: BrowserCommand = async (ctx) => {
  await ctx.page.mouse.down();
};

const mouseUp: BrowserCommand = async (ctx) => {
  await ctx.page.mouse.up();
};

export default defineConfig({
  // Tests acquire their fixtures with `using`. Oxc downlevels `using` to a
  // helper from `@oxc-project/runtime` (not a dependency) unless the target
  // keeps it native; the test runner is the pinned dev Node, which supports
  // it. Only the test transform is affected; the library build has its own
  // config and its own, lower, target.
  oxc: { target: 'esnext' },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          // Test files are being migrated from .js to .ts; match both until
          // the migration completes. The playground page (see
          // `demo/playground`) has tests of its own; coverage below stays
          // scoped to `src`, so demo code never moves the thresholds.
          include: ['src/**/*.test.{js,ts}', 'demo/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
          // Run the type level tests (`*.test-d.ts`) alongside the runtime
          // ones.
          typecheck: { enabled: true },
        },
      },
      {
        test: {
          name: 'visual',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // The default 414x896 viewport is smaller than the mounted
            // surface, and menu items extend past it too. A fixed, larger
            // viewport keeps every gesture coordinate, derived from the
            // surface's own bounding box, identical across runs.
            viewport: { width: 800, height: 600 },
            instances: [{ browser: 'chromium' }],
            commands: { mouseMove, mouseDown, mouseUp },
          },
        },
      },
    ],
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
