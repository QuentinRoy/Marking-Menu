import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { firefox, type CDPSession } from 'playwright';
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
// straight through the Chromium DevTools Protocol instead. One CDP
// session per test session, kept across commands so several fingers (several
// concurrent `press()` calls in `src/__tests__/__fixtures__/browser-menu.ts`)
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

// Vitest's own browser `page` has no media emulation, only the real
// Playwright page behind it does.
const emulateMedia: BrowserCommand<
  [
    options: {
      reducedMotion?: 'reduce' | 'no-preference';
      forcedColors?: 'active' | 'none';
    },
  ]
> = async (ctx, options) => {
  await ctx.page.emulateMedia(options);
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

// Chromium turns this into a real `pointercancel`, the way a touch taken over
// by the platform (a scroll, a system gesture) ends. The DevTools Protocol
// cancels every active touch point at once, so this lifts them all.
const touchCancel: BrowserCommand = async (ctx) => {
  const session = await getTouchSession(ctx);
  await session.client.send('Input.dispatchTouchEvent', {
    touchPoints: [],
    type: 'touchCancel',
  });
  session.points.clear();
};

type MouseButton = 'left' | 'middle' | 'right';

const mouseMove: BrowserCommand<
  [x: number, y: number, steps?: number]
> = async (ctx, x, y, steps = 1) => {
  const origin = await iframeOrigin(ctx);
  await ctx.page.mouse.move(origin.x + x, origin.y + y, { steps });
};

const mouseDown: BrowserCommand<[button: MouseButton]> = async (
  ctx,
  button,
) => {
  await ctx.page.mouse.down({ button });
};

const mouseUp: BrowserCommand<[button: MouseButton]> = async (ctx, button) => {
  await ctx.page.mouse.up({ button });
};

const firefoxProvider = () => {
  if (process.platform !== 'darwin') {
    return playwright();
  }

  const executable = firefox.executablePath();
  const source = join(
    dirname(dirname(executable)),
    'Resources/application.ini',
  );
  if (!existsSync(source)) {
    return playwright();
  }

  // On Macs, the system can deny Firefox's shared application data even when Playwright's
  // temporary profile is accessible. A separate app identity avoids it. The
  // app file must live inside Firefox's browser resources so Gecko can find
  // its other resources.
  const directory = mkdtempSync(join(tmpdir(), 'marking-menu-firefox-'));
  const appIni = join(
    dirname(source),
    'browser',
    `marking-menu-${randomUUID()}.ini`,
  );
  const wrapper = join(directory, 'firefox');
  const original = readFileSync(source, 'utf8');
  writeFileSync(
    appIni,
    original
      .replace(/^Vendor=.*$/mv, 'Vendor=MarkingMenuTests')
      .replace(/^Name=.*$/mv, 'Name=MarkingMenuFirefox'),
  );

  const shellQuote = (value: string): string =>
    `'${value.replaceAll("'", `'"'"'`)}'`;
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexec ${shellQuote(executable)} -app ${shellQuote(appIni)} "$@"\n`,
    { mode: 0o755 },
  );
  process.once('exit', () => {
    rmSync(directory, { recursive: true, force: true });
    rmSync(appIni, { force: true });
  });

  return playwright({ launchOptions: { executablePath: wrapper } });
};

export default defineConfig({
  // Tests acquire their fixtures with `using`. Oxc downlevels `using` to a
  // helper from `@oxc-project/runtime` (not a dependency) unless the target
  // keeps it native; the test runner is the pinned dev Node, which supports
  // it. Only the test transform is affected; the library build has its own
  // config and its own, lower, target.
  oxc: { target: 'esnext' },
  optimizeDeps: { noDiscovery: true, include: ['axe-core', 'totorobot'] },
  test: {
    globals: true,
    silent: 'passed-only',
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          // The playground page (see `demo/playground`) has tests of its own;
          // coverage below stays scoped to `src`, so demo code never moves the
          // thresholds.
          include: ['src/**/*.test.ts', 'demo/**/*.test.ts'],
          exclude: [
            '**/*.browser.test.ts',
            '**/*.cross-browser.test.ts',
            '**/*.dist.test.ts',
          ],
          // Run the type level tests (`*.test-d.ts`) alongside the runtime
          // ones.
          typecheck: { enabled: true },
        },
      },
      {
        publicDir: 'demo-dist',
        test: {
          name: 'browser',
          // Browser files share an orchestrator page and its mouse. Concurrent
          // gesture tests can move that mouse out from under each other.
          fileParallelism: false,
          include: [
            'src/**/*.browser.test.ts',
            'src/**/*.cross-browser.test.ts',
            'src/**/*.dist.test.ts',
            'demo/**/*.dist.test.ts',
          ],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // The default 414x896 viewport is smaller than the mounted
            // surface, and menu items extend past it too. A fixed, larger
            // viewport keeps every gesture coordinate, derived from the
            // surface's own bounding box, identical across runs.
            viewport: { width: 800, height: 600 },
            instances: [
              {
                browser: 'chromium',
                name: 'browser (chromium)',
                include: [
                  'src/**/*.browser.test.ts',
                  'src/**/*.cross-browser.test.ts',
                ],
                provider: playwright({ contextOptions: { hasTouch: true } }),
              },
              {
                browser: 'firefox',
                name: 'browser (firefox)',
                include: ['src/**/*.cross-browser.test.ts'],
                provider: firefoxProvider(),
              },
              {
                browser: 'webkit',
                name: 'browser (webkit)',
                include: ['src/**/*.cross-browser.test.ts'],
              },
              {
                browser: 'chromium',
                name: 'browser (dist)',
                include: ['src/**/*.dist.test.ts', 'demo/**/*.dist.test.ts'],
              },
            ],
            commands: {
              touchStart,
              touchMove,
              touchEnd,
              touchCancel,
              mouseMove,
              mouseDown,
              mouseUp,
              emulateMedia,
            },
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
