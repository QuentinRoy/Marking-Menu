# Vitest browser mode: coverage, several browsers, fake timers, and module aliasing

This note answers what the move from jsdom and the Playwright suite to Vitest browser mode can rely on. It covers the versions this repository pins: `vitest@5.0.0`, `@vitest/browser@5.0.0`, `@vitest/browser-playwright@5.0.0`, `@vitest/coverage-v8@5.0.0`, and `playwright@1.63.0`.

Sources are the installed package code under `node_modules` and the vitest.dev docs. Where the note says "checked", a throwaway config ran the behavior on macOS against Chromium, Firefox, and WebKit from Playwright 1.63.0. That config is not part of the repository.

## Summary

- `@vitest/coverage-v8` works on Chromium only. With coverage turned on, a Firefox or WebKit instance in the same run stops Vitest at startup. Filtering those instances out with `--project` makes the error go away, so the plan is one coverage run (`unit` plus the Chromium instance) and a separate run for the other browsers without coverage.
- Coverage from a Node project and a Chromium browser project merges into one report, and the thresholds apply to the merged numbers.
- Each browser instance can have its own `include` and `exclude`, and its own `provider` with its own `contextOptions` (such as `hasTouch`). No separate project is needed.
- Custom `commands` belong to the whole project, not to an instance. On Firefox and WebKit, the touch commands fail at the moment a test calls them, because Playwright only opens DevTools Protocol sessions on Chromium.
- `vi.useFakeTimers()` fakes `requestAnimationFrame` by default, on all three browsers.
- A project's own `resolve.alias` for `marking-menu` applies to that project only. Even without an alias, the package's self-reference already resolves `marking-menu` to `dist/index.js`. The dependency optimizer does not touch that file.
- Tests that use an iframe work. Locators reach into it through `page.frameLocator()`, which only the Playwright provider supports. Nodes in the iframe fail `instanceof` checks against the test's own globals, and touch coordinates need the iframe's offset.

## Coverage

### V8 coverage needs Chromium

In browser mode, `@vitest/coverage-v8` does not measure coverage inside the page. It registers two browser commands, `__vitest_startV8Coverage` and `__vitest_takeV8Coverage`, and they call `Profiler.startPreciseCoverage` and `Profiler.takePreciseCoverage` over a DevTools Protocol session (`@vitest/coverage-v8/dist/commands-*.js`, `@vitest/coverage-v8/dist/browser.js`). The Playwright provider opens that session with `page.context().newCDPSession(page)` (`getCDPSession` in `@vitest/browser-playwright/dist/index.js`), and Playwright only supports that on Chromium.

Vitest checks this before running anything. `expandBrowserInstancesInEntries` in `vitest/dist/chunks/index.*.js` looks at every instance that survives the `--project` filter. If the instance is not Chromium (`isChromiumName` accepts only `chromium` for Playwright), coverage is enabled, and the provider is `v8`, it throws `@vitest/coverage-v8 does not work with ...`. The error suggests either keeping only `chromium` or switching to Istanbul. Checked: `vitest run --coverage` with Chromium, Firefox, and WebKit instances fails at startup with that message.

The check runs on the instances left after filtering. Checked: `vitest run --coverage --project unit --project 'browser (chromium)'` runs and writes a report. Negative filters such as `--project '!browser (firefox)'` work as well.

The vitest.dev coverage guide says the same thing in prose: V8 works in Chromium-based browsers, and Istanbul "works on any Javascript runtime" because it instruments the source first ([Coverage guide](https://vitest.dev/guide/coverage)).

### Istanbul is possible, but it is all or nothing

`coverage` is a root-only option. It is in the `NonProjectOptions` list in `vitest/dist/chunks/plugin.d.*.d.ts`, so one provider applies to every project in a run. Switching to Istanbul to cover Firefox and WebKit would also move the `unit` project to Istanbul. That means adding `@vitest/coverage-istanbul`, which the repository doesn't have, and the numbers measured against the current thresholds could shift, since Istanbul instruments the source instead of mapping V8 counters back through `ast-v8-to-istanbul`.

Covering Firefox and WebKit only adds value when some source lines run on those browsers alone. The Playwright suite runs Firefox and WebKit only for its `*.cross-browser.spec.ts` files, and the same code already runs on Chromium. So the lighter option is V8 on `unit` plus Chromium, with Firefox and WebKit running without coverage.

### Node and browser coverage merge correctly

`V8CoverageProvider.generateCoverage` reads every coverage file, converts each project's scripts to Istanbul format using that project's source maps, and merges them into one coverage map. Thresholds are then checked on that merged map (`@vitest/coverage-v8/dist/provider.js`). Checked with a Node test calling one function in `src/utils.ts` (through a helper, 2 of 14 functions) and a Chromium test calling a different one (1 of 14): the combined run reported 3 of 14. Coverage thresholds therefore apply to `unit` and `browser` together, as the plan requires.

## Several browsers

### Per-instance test files

`BrowserInstanceOption` extends the project config, minus a short list of properties (`browser`, `typecheck`, `alias`, `sequence`, `root`, `pool`, `runner`, `api`, `deps`, `environment`, `environmentOptions`, `server`, `benchmark`, `name`). `include`, `exclude`, `includeSource`, and `setupFiles` stay available. `cloneProjectConfigForBrowserInstance` uses the instance's `include` and `exclude` in place of the parent's when the instance sets them.

Checked: with `include` on the Firefox instance only, Chromium and WebKit ran every browser test file and Firefox ran only the listed file. Mirroring the Playwright setup therefore needs one `browser` project, not one project per browser:

```ts
instances: [
  { browser: 'chromium' },
  { browser: 'firefox', include: ['src/**/*.cross-browser.browser.test.ts'] },
  { browser: 'webkit', include: ['src/**/*.cross-browser.browser.test.ts'] },
],
```

Instance project names are `<project> (<browser>)`, for example `browser (chromium)`, and `--project` accepts them.

### Custom commands on Firefox and WebKit

`commands` sits under `browser` and is not one of the options an instance can set, so every instance gets the same commands. Registration does no browser check. A command fails only when it runs. Checked: a command that calls `ctx.context.newCDPSession(ctx.page)`, as `touchStart`, `touchMove`, and `touchEnd` in `vitest.config.ts` do, returns normally on Chromium and throws `browserContext.newCDPSession: CDP session is only available in Chromium` on Firefox and WebKit. The test that called it fails.

So keep touch tests off Firefox and WebKit, either through the per-instance `include` above or by skipping on `server.browser !== 'chromium'` (`server` from `vitest/browser`). Commands built on Playwright's `page.mouse` don't use the DevTools Protocol. They should work on every browser, but that wasn't checked here.

## Context options per instance

An instance can set its own `provider`, as long as it has the same provider name as the parent. Mixing providers throws `The instance cannot have a different provider from its parent`. The instance's provider replaces the parent's, so its options are not merged: repeat any parent `contextOptions` the instance still needs. `playwright()` accepts `contextOptions`, minus `ignoreHTTPSErrors` and `serviceWorkers` (`@vitest/browser-playwright/dist/index.d.ts`).

Checked, with `playwright({ contextOptions: { hasTouch: true } })` on the parent and `playwright({ contextOptions: { hasTouch: false } })` on the Firefox instance:

| Instance                   | `'ontouchstart' in window` | `navigator.maxTouchPoints` |
| -------------------------- | -------------------------- | -------------------------- |
| Chromium, `hasTouch: true` | `true`                     | 1                          |
| WebKit, `hasTouch: true`   | `true`                     | 0                          |
| Firefox, `hasTouch: false` | `false`                    | 0                          |

`viewport`, `headless`, `locators`, `testerHtmlPath`, `screenshotDirectory`, and `screenshotFailures` can also be set per instance.

## Fake timers and `requestAnimationFrame`

`vi.useFakeTimers()` without `toFake` fakes every timer that `@sinonjs/fake-timers` finds on the global object, except `nextTick` and `queueMicrotask` (the `useFakeTimers` code in `vitest/dist/chunks/index.*.js`). In a browser that includes `requestAnimationFrame`, `cancelAnimationFrame`, and `performance`.

Checked on all three browsers: after `vi.useFakeTimers()`, a `requestAnimationFrame` callback ran on `vi.advanceTimersByTime(20)`, a 1000 ms `setTimeout` ran on `await vi.advanceTimersByTimeAsync(1000)`, and `expect.element` worked once `vi.useRealTimers()` had been called. The existing `src/__fixtures__/browser-menu.ts` and `src/menu.browser.test.ts` already rely on this on Chromium. `openMenu` advances fake time through the dwell delay and then polls for the open menu.

The current jsdom tests that stub `requestAnimationFrame` by hand, such as `src/layout/raf-throttle.test.ts` and `src/engine/renderer.test.ts`, can use the default fake timers instead.

## Pointing `marking-menu` at the built bundle

### Aliases stay per project

An inline project can carry Vite options next to `test`, including `resolve.alias`. Vitest keeps browser projects apart by their Vite config, for example when it gathers dependencies to optimize (`resolveBrowserOptimizeDeps` runs once per Vite config in `vitest/dist/chunks/index.*.js`). Checked: in one run, a `bundle` project aliasing `marking-menu` to `dist/index.js` and a `browser` project aliasing it to `src/index.ts` each loaded their own target.

```ts
{
  resolve: {
    alias: { 'marking-menu': path.resolve(import.meta.dirname, 'dist/index.js') },
  },
  test: {
    name: 'bundle',
    include: ['src/**/*.bundle.browser.test.ts'],
    browser: { /* same provider and instances as the browser project */ },
  },
},
```

The alias isn't strictly needed. `package.json` has `"name": "marking-menu"` and `"exports": { ".": "./dist/index.js" }`, so a bare `import 'marking-menu'` from inside the repository resolves to `dist/index.js` through package self-reference. Checked: with no alias, the browser loaded `/dist/index.js`. An explicit alias still documents the intent, and it fails loudly if the file is missing. The bundle has to be built first (`yarn build`), and `dist/` is not committed.

The built bundle carries its CSS inline, since `src/layout/menu.ts` imports `menu.css?inline` and the build minifies it with lightningcss. Loading `dist/index.js` alone is therefore enough to test the processed CSS.

### The dependency optimizer

The optimizer only pre-bundles bare imports that resolve into `node_modules`. `dist/index.js` sits in the repository, so Vite serves it as a plain source file. Checked: the browser requested `/dist/index.js` with no `?v=` hash and no `.vite/deps` path, so the file ran as built. If the test instead installs a packed tarball under `node_modules/marking-menu`, the optimizer would re-bundle it. Adding `optimizeDeps: { exclude: ['marking-menu'] }` to that project keeps the file unchanged. That case wasn't checked here.

## Rendering into another document or an iframe

Browser mode already runs each test file inside an iframe of the orchestrator page. A test can create a nested `<iframe>` and render into its `contentDocument`, as `e2e/fixture/cross-document.ts` does today. Four things to keep in mind:

- Locators such as `page.getByRole` only search the test's own document. `page.frameLocator(locator)` enters a child iframe. Its type comment in `@vitest/browser/context.d.ts` warns that only the `playwright` provider supports it. Checked: `page.frameLocator(page.elementLocator(iframe)).getByRole('button').click()` clicked a button inside a nested iframe on Chromium, Firefox, and WebKit.
- Nodes created in the nested iframe are not `instanceof` the test realm's `HTMLElement`. Checked on all three browsers. That's the cross-realm case the library has to handle, so assertions should use the iframe window's constructors or duck typing.
- The touch commands add only the test iframe's offset (`iframeOrigin` in `vitest.config.ts`). A gesture aimed at a nested iframe also needs that iframe's own `getBoundingClientRect()` offset added in the test.
- `toMatchScreenshot` on an element inside a nested iframe wasn't checked here, and neither was Vitest's issue tracker.
