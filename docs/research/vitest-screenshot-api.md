# Issue #338: Vitest 5 browser-mode screenshot API

Question: what Vitest 5 browser mode (with `@vitest/browser-playwright`) provides for screenshot testing, and how it must be configured here. Parent map: #337.

Sources: the published `vitest@5.0.0` (installed in this repo), `@vitest/browser@5.0.0` and `@vitest/browser-playwright@5.0.0` tarballs from npm (`npm pack`), and the Vitest docs. File references below point into those packages. Vitest 5.0.0 is the current `latest` tag (checked 2026-09-14).

- Docs: [Visual regression testing](https://vitest.dev/guide/browser/visual-regression-testing), [`toMatchScreenshot`](https://vitest.dev/api/browser/assertions), [`browser.expect`](https://vitest.dev/config/browser/expect), [Commands](https://vitest.dev/api/browser/commands), [Playwright provider](https://vitest.dev/config/browser/playwright)
- Reference implementation (Vitest 4): [QuentinRoy/word-cloud](https://github.com/QuentinRoy/word-cloud) `vitest.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/update-vitest-screenshots.yml`

## Packages to add

`@vitest/browser-playwright@5.0.0` depends on `@vitest/browser@5.0.0` and peers on `vitest: 5.0.0` (exact) and `playwright: *` (non-optional). `@vitest/browser` in turn peers on `vitest: 5.0.0` (exact). So:

- Add `@vitest/browser-playwright` and `playwright` as dev dependencies. `@vitest/browser` comes transitively; add it explicitly only if the code imports `vitest/browser` types from it (the `vitest/browser` entry is what tests import).
- All `vitest` / `@vitest/*` packages must stay on the exact same version (`@vitest/coverage-v8` is already `^5.0.0`). Renovate should group them.

## Playwright version alignment

- `@vitest/browser-playwright` accepts any `playwright` (`*`); it was built against `^1.62.1` (its devDependency). Nothing forces a specific version.
- The repo already resolves `@playwright/test@1.63.0` → `playwright@1.63.0` → `playwright-core@1.63.0` (`node_modules/*/package.json`). Declaring `playwright` at `^1.63.0` (same range as `@playwright/test`) makes Yarn reuse that single copy.
- Browser binaries are keyed to the `playwright-core` version, so the pinned `mcr.microsoft.com/playwright:v1.63.0-noble` image matches as long as `playwright` resolves to 1.63.0. The `playwright` package must be added to the Renovate group that bumps `@playwright/test` and the image tag (and, once e2e is gone, `@playwright/test` may disappear from that group).

## `toMatchScreenshot`

Usage (types in `@vitest/browser/jest-dom.d.ts`, implementation `expect-element.js`):

```ts
await expect.element(locatorOrElement).toMatchScreenshot(name?, options?)
await expect(page).toMatchScreenshot(name?, options?) // whole page
```

- Cannot be used with `.not`; needs a test context.
- Default `name` is `` `${currentTestName} ${n}` `` where `n` counts calls within the test (1-based), so the first call in test `menu > opens` is `menu > opens 1`.
- `target` is `page` when the subject has a `viewport()` method (the `page` object), else `element`. With no element, Playwright screenshots the iframe's `body` (`@vitest/browser-playwright/dist/index.js` `takeScreenshot`).

Options (`ScreenshotMatcherOptions`, `@vitest/browser/context.d.ts`), defaults from `@vitest/browser/dist/index.js` `defaultOptions`:

| Option | Default | Notes |
| --- | --- | --- |
| `comparatorName` | `'pixelmatch'` | Only built-in comparator. Custom ones via `browser.expect.toMatchScreenshot.comparators`. |
| `comparatorOptions` | `{}` | See below. |
| `screenshotOptions` | `{ animations: 'disabled', caret: 'hide', fullPage: false, maskColor: '#ff00ff', omitBackground: false, scale: 'device' }` | Playwright screenshot options minus `element`, `base64`, `path`, `save`, `type`, `strict`, `timeout`. `mask` takes locators. |
| `timeout` | `5000` | Time to find a stable screenshot. `0` = no timeout. |
| `strict` | `true` | Locator must resolve to one element. |

`pixelmatch` comparator options (implemented with `@blazediff/core`, a pixelmatch-compatible diff):

| Option | Default | Meaning |
| --- | --- | --- |
| `threshold` | `0.1` | Per-pixel YIQ color distance, 0 strict to 1 lenient. |
| `allowedMismatchedPixels` | `undefined` | Absolute count allowed. |
| `allowedMismatchedPixelRatio` | `undefined` | Ratio 0–1 of image area. If both set, the smaller allowance wins. If neither, 0 pixels allowed. |
| `includeAA` | `false` | `true` disables anti-aliasing detection. |
| `alpha`, `aaColor`, `diffColor`, `diffColorAlt`, `diffMask` | `0.1`, `[255,255,0]`, `[255,0,0]`, `undefined`, `false` | Diff image rendering only. |

Project-wide defaults go in `test.browser.expect.toMatchScreenshot` (same shape plus `comparators`, `screenshotDirectory`, `resolveScreenshotPath`, `resolveDiffPath`). They are deep-merged under the per-call options.

### Matching algorithm (`screenshotMatcher`)

1. Read the reference file if present. Take a screenshot; with `pixelmatch`, a byte-identical PNG passes immediately.
2. Otherwise loop: capture, compare with the previous capture (or the reference first), until two consecutive captures pass the comparator or `timeout` hits.
3. If the first capture already matched the reference within tolerance, pass. Otherwise compare the stable capture with the reference.

A capture within tolerance of the reference passes and writes nothing, so small anti-aliasing drift never churns baselines.

## Paths

Default reference path (`defaultOptions.resolveScreenshotPath`):

```
<root>/<testFileDirectory>/__screenshots__/<testFileName>/<arg>-<browserName>-<platform>.png
```

- `arg`: the name, sanitized: whitespace runs → `-`, characters outside `[\w-]` dropped, repeated `-` collapsed; `/` kept as subdirectories; a `.png` extension is stripped. `menu > opens 1` → `menu-opens-1`.
- `browserName`: the instance's `browser`, e.g. `chromium`.
- `platform`: `os.platform()` of the Vitest Node process (not the browser): `linux` in the Playwright container, `darwin` on macOS.
- `testFileName` keeps its extension: `src/visual.browser.test.ts` → `src/__screenshots__/visual.browser.test.ts/menu-opens-1-chromium-linux.png`.
- Only PNG is supported.

Diff/actual files (`resolveDiffPath`), written only on failure:

```
<root>/<attachmentsDir>/<testFileDirectory>/<testFileName>/<arg>-{actual,diff,reference}-<browserName>-<platform>.png
```

`attachmentsDir` defaults to `.vitest/attachments` (vitest `resolveConfig`).

Unrelated but same directory: `browser.screenshotFailures` defaults to `!browser.ui` (so on for headless runs). On any failing test it saves a page screenshot under `__screenshots__/<testFileName>/` with a name **without** the browser/platform suffix. A `.gitignore` that keeps only `*-chromium-linux.png` there handles both these and non-Linux local baselines; alternatively set `screenshotFailures: false`.

## Update semantics

`snapshotOptions.updateSnapshot` (vitest `resolveConfig`): `-u`/`--update` accepts `true`, `"all"`, `"new"`, `"none"`; env `UPDATE_SNAPSHOT` also works. Resolution: explicit value if one of the three; else `none` when `CI` is set and no flag; `all` when the flag is truthy; `new` otherwise.

Outcomes (`determineOutcome` / `buildOutput`):

| State | `all` (`--update`) | `new` (local default) | `none` (CI default) |
| --- | --- | --- | --- |
| No reference | Writes reference, **passes** | Writes reference, **fails**: "No existing reference screenshot found; a new one was created. Review it before running tests again." | Writes capture to attachments as `-reference-`, **fails**: "No existing reference screenshot found." |
| Matches (byte-identical or within tolerance) | Passes, no write | Passes, no write | Passes, no write |
| Mismatch | Overwrites reference, passes | Writes actual+diff, fails | Writes actual+diff, fails |
| Never stable | Fails: "Could not capture a stable screenshot within {timeout}ms." | same | same |

So `--update` only rewrites references that are missing or out of tolerance; it never rewrites matching ones. It does not delete references of removed tests (screenshots are not tracked as obsolete snapshots). `git status` after `vitest run --update` in CI therefore lists exactly the changed baselines.

Note that a missing baseline passes under `--update` but fails without it, even locally.

## Failure message (JSON reporter)

The JSON reporter writes `assertionResults[].failureMessages` as `error.stack || error.message` (vitest `JsonReporter`). The matcher message (built in the browser, `expect-element.js`) is:

```
expect(<page|element>).toMatchScreenshot()

Screenshot does not match the stored reference.
<N> pixels (ratio <R>) differ.

Reference screenshot:
  <path>

Actual screenshot:
  <path>

Diff image:
  <path>
```

- `<N> pixels (ratio <R>) differ.` is the pixelmatch comparator message; the ratio is rounded up to 2 decimals.
- Colors: `tinyrainbow` enables ANSI colors when `CI` is set or `window.chrome` exists, and the message is built inside Chromium, so the hint and paths carry escape codes. The plain sentences do not.
- Stable substrings to grep: `Screenshot does not match the stored reference.` (mismatch only); `toMatchScreenshot` (any failure of this matcher, including missing reference and unstable capture; this is what word-cloud's CI `jq` filter uses).
- The matcher also attaches a `visual-regression` annotation (`type: 'internal:toMatchScreenshot'`) with the reference/actual/diff attachments, and returns `meta: { outcome }` (`mismatch`, `missing-reference`, `unstable-screenshot`).

## Custom commands and the Playwright `page`

Define in config (`test.browser.commands`), typed with `BrowserCommand` from `vitest/node`:

```ts
import type { BrowserCommand } from 'vitest/node';

const mouseMove: BrowserCommand<[x: number, y: number]> = async (ctx, x, y) => {
  if (ctx.provider.name !== 'playwright') throw new Error('playwright only');
  const box = await ctx.iframe.owner().boundingBox(); // iframe offset in the page
  await ctx.page.mouse.move(box!.x + x, box!.y + y);
};
```

- `@vitest/browser-playwright` augments `vitest/node`'s `BrowserCommandContext` with `page: Page`, `frame(): Promise<Frame>`, `iframe: FrameLocator` (`[data-vitest="true"]`), `context: BrowserContext` (`dist/index.d.ts`). Once the package is imported in the config, `ctx.page` is typed; word-cloud's `as unknown as` cast is unnecessary.
- `ctx.page` is the orchestrator page that contains the test iframe (docs: "the full page that contains the test iframe"). `page.mouse` coordinates are therefore relative to that page, not the iframe. Built-in commands use it the same way (`__vitest_wheel` calls `context.page.mouse.wheel`).
- The iframe is only CSS-scaled in UI mode (`orchestrator` `createTestIframe`), so in headless runs iframe CSS px = page px; adding the iframe's bounding box origin converts iframe-local coordinates. Viewport defaults to 414×896 (`browser.viewport`); `page.viewport(w, h)` resizes via `page.setViewportSize`.
- In headless mode the context keeps a fixed viewport (not `null`), so device scale factor does not follow the host (`getContextOptions` comment).
- Call from tests via `import { commands } from 'vitest/browser'`; type with module augmentation:

```ts
declare module 'vitest/browser' {
  interface BrowserCommands {
    mouseMove: (x: number, y: number) => Promise<void>;
  }
}
```

## Minimal config shape

```ts
import { playwright } from '@vitest/browser-playwright';

// inside test.projects
{
  test: {
    name: 'visual',
    include: ['src/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
      commands: { mouseMove /* ... */ },
      // expect: { toMatchScreenshot: { comparatorOptions: { ... } } },
    },
  },
}
```
