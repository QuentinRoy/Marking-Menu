import { defineConfig, devices } from '@playwright/test';

// Menu items extend past the gesture surface itself (see
// `e2e/fixture/style.css`); a fixed viewport keeps that margin, and hence
// every gesture coordinate the tests derive from the surface's bounding box,
// identical across runs and machines.
const viewport = { width: 800, height: 600 };

export default defineConfig({
  testDir: './tests',
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
      // `multiple-controllers.spec.ts` drives the library directly (no
      // pointer input), so one browser is enough coverage for it; it rides
      // along with this project rather than getting its own.
      name: 'chromium',
      testMatch: /(?:mouse|multiple-controllers)\.spec\.ts/v,
      use: { ...devices['Desktop Chrome'], viewport },
    },
    {
      name: 'firefox',
      testMatch: /mouse\.spec\.ts/v,
      use: { ...devices['Desktop Firefox'], viewport },
    },
    {
      name: 'webkit',
      testMatch: /mouse\.spec\.ts/v,
      use: { ...devices['Desktop Safari'], viewport },
    },
    {
      // `concurrent-pointers.spec.ts` needs the same CDP-driven native touch
      // input as `touch.spec.ts` (see `e2e/helpers/touch.ts`), to get a
      // genuine second pointer id rather than a simulated one.
      name: 'chromium-touch',
      testMatch: /(?:concurrent-pointers|touch)\.spec\.ts/v,
      use: { ...devices['Desktop Chrome'], hasTouch: true, viewport },
    },
  ],
});
