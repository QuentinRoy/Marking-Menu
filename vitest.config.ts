import { playwright } from '@vitest/browser-playwright';
import type { CDPSession } from 'playwright';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';

// `ctx.page` is the orchestrator page holding the test iframe. Its input
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

// Touch, not mouse: touchscreens are this library's main target, and
// `page.touchscreen` only offers an atomic tap, so gestures are driven
// straight through the Chromium DevTools Protocol instead, the same way
// `e2e/helpers/touch.ts` drives the functional Playwright suite. One CDP
// session per test session, kept across commands so several fingers
// (several concurrent `press()` calls in `src/__fixtures__/browser-menu.ts`)
// can move and lift independently while sharing one active-touch-points
// dispatch, mirroring `CdpMultiTouchDrag`.
type TouchSession = {
  readonly client: CDPSession;
  readonly points: Map<number, { x: number; y: number }>;
};

const touchSessions = new Map<string, TouchSession>();

const getTouchSession = async (
  ctx: BrowserCommandContext,
): Promise<TouchSession> => {
  const existing = touchSessions.get(ctx.sessionId);
  if (existing) {
    return existing;
  }

  const client = await ctx.context.newCDPSession(ctx.page);
  const session: TouchSession = { client, points: new Map() };
  touchSessions.set(ctx.sessionId, session);
  return session;
};

const dispatchActiveTouches = async (
  session: TouchSession,
  type: 'touchStart' | 'touchMove',
): Promise<void> => {
  const touchPoints = [...session.points].map(([id, { x, y }]) => ({
    id,
    x,
    y,
  }));
  await session.client.send('Input.dispatchTouchEvent', { touchPoints, type });
};

const touchStart: BrowserCommand<[id: number, x: number, y: number]> = async (
  ctx,
  id,
  x,
  y,
) => {
  const origin = await iframeOrigin(ctx);
  const session = await getTouchSession(ctx);
  session.points.set(id, { x: origin.x + x, y: origin.y + y });
  await dispatchActiveTouches(session, 'touchStart');
};

const touchMove: BrowserCommand<[id: number, x: number, y: number]> = async (
  ctx,
  id,
  x,
  y,
) => {
  const origin = await iframeOrigin(ctx);
  const session = await getTouchSession(ctx);
  session.points.set(id, { x: origin.x + x, y: origin.y + y });
  await dispatchActiveTouches(session, 'touchMove');
};

const touchEnd: BrowserCommand<[id: number]> = async (ctx, id) => {
  const session = await getTouchSession(ctx);
  const point = session.points.get(id);
  if (!point) {
    throw new Error(`No active touch point with id ${id}.`);
  }

  await session.client.send('Input.dispatchTouchEvent', {
    touchPoints: [{ id, ...point }],
    type: 'touchEnd',
  });
  session.points.delete(id);
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
            provider: playwright({ contextOptions: { hasTouch: true } }),
            headless: true,
            // The default 414x896 viewport is smaller than the mounted
            // surface, and menu items extend past it too. A fixed, larger
            // viewport keeps every gesture coordinate, derived from the
            // surface's own bounding box, identical across runs.
            viewport: { width: 800, height: 600 },
            instances: [{ browser: 'chromium' }],
            commands: { touchStart, touchMove, touchEnd },
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
