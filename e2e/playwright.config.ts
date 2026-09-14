import { defineConfig, devices } from '@playwright/test';

// Menu items extend past the gesture surface itself (see
// `e2e/fixture/style.css`); a fixed viewport keeps that margin, and hence
// every gesture coordinate the tests derive from the surface's bounding box,
// identical across runs and machines.
const viewport = { width: 800, height: 600 };

export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  // Project-level concurrency (chromium/firefox/webkit/chromium-touch running
  // side by side) is enough parallelism for now; not enabled within a single
  // spec file yet.
  fullyParallel: false,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  // Only failing tests keep their test-results directory (traces,
  // screenshots); passing runs stay clean.
  preserveOutput: 'failures-only',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport,
  },
  webServer: {
    // Serves the already-built fixture; building it is a separate step
    // (`yarn e2e:build`) so CI can run it once against a downloaded `dist/`
    // instead of paying for a build inside the test run. Playwright runs
    // this command with the config file's own directory as cwd, hence the
    // path relative to `e2e/` rather than the repo root.
    command: 'vite preview --config vite.config.ts',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.CI === undefined,
  },
  projects: [
    {
      // Every spec runs here except the `.touch.spec.ts` ones, which need
      // `hasTouch` (see the `chromium-touch` project below): a plain file,
      // e.g. `disposal.spec.ts`, needs only this one browser for coverage;
      // a `.cross-browser.spec.ts` one also runs under `firefox` and
      // `webkit`.
      name: 'chromium',
      testIgnore: '*.touch.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport },
    },
    {
      name: 'firefox',
      testMatch: '*.cross-browser.spec.ts',
      use: { ...devices['Desktop Firefox'], viewport },
    },
    {
      name: 'webkit',
      testMatch: '*.cross-browser.spec.ts',
      use: { ...devices['Desktop Safari'], viewport },
    },
    {
      // A `.touch.spec.ts` file needs the CDP-driven native touch input
      // `hasTouch` provides (see `e2e/helpers/touch.ts`), to get a genuine
      // touch pointer id rather than a simulated one.
      name: 'chromium-touch',
      testMatch: '*.touch.spec.ts',
      use: { ...devices['Desktop Chrome'], hasTouch: true, viewport },
    },
  ],
});
