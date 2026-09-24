# Test suite environment and overlap inventory

This inventory records the test suite as it stands at `v1.0.1`. It covers the
files selected by the current `unit` Vitest project and every Playwright spec
under `e2e/tests/`. It reports dependencies and overlap; it does not choose the
final file layout or which overlapping assertion survives.

## Summary

The current `unit` project selects 41 files:

- 31 runtime test files run in jsdom today.
- 10 `*.test-d.ts` files are checked by TypeScript and do not run as runtime
  tests.
- Of the 31 runtime files, 16 need no browser platform and can run in the
  future Node project as written.
- 14 touch the DOM and belong in the browser project as written.
- `src/layout/raf-throttle.test.ts` touches no DOM, but it uses
  `requestAnimationFrame`; it needs the browser project as written or an
  explicit scheduler fake before it can run on Node.

The Playwright suite contains 17 spec files. Fifteen exercise a built artifact:
14 use the fixture import map to load the unchanged `dist/marking-menu.js`, and
`deployed-demo.spec.ts` uses the assembled `demo-dist/` site. The two layout
pointer-target specs are the exceptions: `/layout.html` imports
`src/layout/menu.ts` and Vite bundles that source for the fixture.

## Runtime files that can move to Node

These files do not read or create DOM objects. Fake timers do not by themselves
make a test browser-dependent.

| File | What it checks | Non-DOM needs |
| --- | --- | --- |
| `demo/playground/menu-schema.test.ts` | Menu JSON validation and formatting | JSON schema libraries |
| `demo/shared/menu-config.test.ts` | Query-string menu serialization and validation | `URL` and `URLSearchParams`, both available in Node |
| `src/engine/machine.standalone.test.ts` | Standalone navigation states, keyboard and pointer inputs, outputs, and layout descriptions | Fake timers |
| `src/engine/machine.test.ts` | Gesture navigation states, dwell timing, recognition outputs, and layout descriptions | Fake timers |
| `src/engine/runtime.test.ts` | Runtime queuing, event delivery, failure handling, rendering calls, and disposal through fake renderers | Fake timers |
| `src/events.test.ts` | Event value objects and invariants | None; the public events deliberately are not DOM `Event` objects |
| `src/layout/label-layout-validator.test.ts` | Geometry validator failures | None |
| `src/layout/label-layout.perf.test.ts` | Solver performance budget | High-resolution clock |
| `src/layout/label-layout.test.ts` | Label solver constraints, determinism, compaction, and oversized results | None |
| `src/model.test.ts` | Model construction, angles, lookup, parents, validation, and immutability | None |
| `src/recognizer/articulation-points.test.ts` | Articulation-point extraction | None |
| `src/recognizer/find-points.test.ts` | Point-search helpers | None |
| `src/recognizer/generated-stroke-corpus.test.ts` | Recognition accuracy against generated strokes | Deterministic corpus helpers |
| `src/recognizer/recognize-mm-stroke.test.ts` | Recognition and analysis against recorded comma-separated-value strokes | Node file system and path modules, plus `csv-parse` |
| `src/recognizer/stroke-length.test.ts` | Stroke length | None |
| `src/utils.test.ts` | Numeric and tuple helpers | None |

## Runtime files that need a browser as written

| File | Browser behavior it uses | Current emulation or stub |
| --- | --- | --- |
| `src/create-marking-menu.integration.test.ts` | Real element, pointer dispatch, renderer DOM, and disposal | `createParent()` supplies stateful pointer capture; fake timers supply dwell and animation scheduling |
| `src/create-marking-menu.test.ts` | Creates an element to pass as the controller parent, even though the controller itself is mocked | No special stub beyond jsdom |
| `src/engine/controller.standalone.test.ts` | DOM mounting, shadow DOM, focus, keyboard events, pointer events, and parent geometry | Parent rectangle and pointer capture are stubbed |
| `src/engine/controller.test.ts` | End-to-end controller behavior across DOM rendering, shadow DOM, focus, pointer capture, style changes, and animation frames | Stateful pointer capture, parent rectangles, and fake timers/frames |
| `src/engine/focus.test.ts` | `document.activeElement`, focus, blur, and DOM removal | Fake timers for delayed focus |
| `src/engine/gesture-pointer-source.test.ts` | Element event listeners, cancelable touch events, inline `touch-action`, and pointer capture | Stateful pointer capture from `createParent()` |
| `src/engine/renderer.test.ts` | Shadow DOM, SVG, DOM querying, inline styles, element geometry, and animation frames | Parent rectangles and fake timers/frames |
| `src/engine/standalone-session.test.ts` | Real menu DOM, composed pointer paths, focus, keyboard events, shadow DOM, document listeners, and pointer capture | Menu fixture, global no-capture fallback, and a stateful capture override for the capture-specific case |
| `src/layout/gesture-feedback.test.ts` | SVG nodes and DOM removal | Fake timers for trace expiry |
| `src/layout/menu.test.ts` | Shadow DOM, adopted stylesheets, accessibility attributes, focus, composed event paths, SVG wedges, CSS custom properties, and label measurement | Fixed `offsetWidth`/`offsetHeight`; probe-only `getComputedStyle`; jsdom's empty CSS import is replaced with test-set custom properties |
| `src/layout/raf-throttle.test.ts` | `requestAnimationFrame` and `cancelAnimationFrame`, but no DOM nodes | Vitest fake frames work because the current environment supplies the browser frame functions |
| `src/layout/scene.test.ts` | Elements, shadow DOM, DOM order, removal, and parent rectangles | Parent rectangle |
| `src/layout/stroke.test.ts` | SVG path and circle creation, identity, attributes, and connection state | No layout stub |
| `src/layout/svg-surface.test.ts` | SVG namespace, accessibility property, attributes, and insertion | No layout stub |
| `src/move/touch-action.test.ts` | `HTMLElement.style`, property priority, and attribute serialization | No special stub beyond jsdom |

## Type-level files

These files are compile-only. They can remain under the `unit` project's
type-checking configuration; none needs a runtime environment.

| File | Contract checked |
| --- | --- |
| `demo/playground/menu-schema.test-d.ts` | The playground schema and public menu input types accept the same shape |
| `src/create-marking-menu.test-d.ts` | Public factory inference, duplicate identifiers, event narrowing, and logger types |
| `src/engine/controller.test-d.ts` | Controller surface, open options, event narrowing, and state narrowing |
| `src/engine/machine.test-d.ts` | Machine output and state types, including the generic-model plumbing |
| `src/engine/model-node.test-d.ts` | The erased engine model's machine and renderer contracts |
| `src/events.test-d.ts` | Event map, discriminated unions, mode/source/recognition narrowing, and emitter listeners |
| `src/layout/menu.test-d.ts` | Compatibility between real model nodes and the layout model |
| `src/model.test-d.ts` | Literal model inference, traversal, leaves, menus, parents, and duplicate identifiers |
| `src/recognizer/recognize-mm-stroke.test-d.ts` | Narrow leaf and menu recognition results |
| `src/utils.test-d.ts` | Tuple, point, and segment utility types |

## jsdom workarounds

The active workaround surface is smaller than `vitest.setup.ts` suggests.

| Workaround | Files that depend on it | Finding |
| --- | --- | --- |
| `Element.prototype.part` shim in `vitest.setup.ts` | None | There is no current `.part` production call site. The shim runs for every jsdom test but no test depends on its behavior. |
| `matchMedia` shim in `vitest.setup.ts` | None | There is no current production `matchMedia` call site. The shim is unused. |
| `hasPointerCapture` and `releasePointerCapture` fallback in `vitest.setup.ts` | `src/engine/standalone-session.test.ts` | Normal standalone pointer releases call these methods on menu items. The capture-specific case replaces them with stateful functions. |
| Stateful `createParent()` pointer capture | `src/create-marking-menu.integration.test.ts`, both controller suites, and `src/engine/gesture-pointer-source.test.ts` | Supplies all three capture methods and tracks captured pointer identifiers. This is behavior emulation, not only a missing-method guard. |
| Stubbed parent rectangles | Both controller suites, `src/engine/renderer.test.ts`, and `src/layout/scene.test.ts` | jsdom has no layout, so client-to-local coordinate assertions provide their own rectangles. |
| Stubbed label dimensions | `src/layout/menu.test.ts` | Fixed `offsetWidth` and `offsetHeight` stand in for actual plate layout. |
| Stubbed computed styles for layout probes | `src/layout/menu.test.ts` | Vitest resolves the CSS text import to empty text in this project. The test maps probe classes back to custom-property values. |
| Fake animation frames | Controller, renderer, and `src/layout/raf-throttle.test.ts` | `vi.advanceTimersToNextFrame()` drives work scheduled with `requestAnimationFrame`. |

## Playwright fixtures

Every spec imports `e2e/helpers/fixtures.ts`. That fixture opens the project's
base page and fails the test after its body if the page emitted an uncaught
error or `console.error`.

The pages are:

- `/` from `e2e/fixture/index.html`: creates the standard eight-item menu and
  writes public events to `#log`. Its import map resolves `marking-menu` to the
  copied, unchanged `dist/marking-menu.js`.
- `/cross-document.html`: creates the controller in the top page while its
  parent lives in an iframe document. It also loads the copied distribution
  file through an import map.
- `/layout.html`: imports the internal `createMenu` source and records which
  painted item region received a pointer press. It does not use the built
  package.
- The `deployed-demo` project serves `demo-dist/` on a separate port and opens
  that site's root page.

Browser selection follows filename and project:

- A plain `*.spec.ts` file runs in Chromium.
- A `*.cross-browser.spec.ts` file runs in Chromium, Firefox, and WebKit.
- A `*.touch.spec.ts` file runs only in the touch-enabled Chromium project.
- `deployed-demo.spec.ts` runs only in the dedicated Chromium demo project.

## Playwright spec inventory

`fixtures` below means the common fresh-page and error-capture fixture.

| Spec | Page and artifact | Browsers and input | Other helpers and behavior |
| --- | --- | --- | --- |
| `concurrent-pointers.touch.spec.ts` | Main fixture; built distribution | Touch Chromium; genuine multi-contact touch through the Chrome DevTools Protocol | `gestures`, `log`, `touch`; verifies gesture ownership, ignored decoy fingers, and recovery for a fresh gesture |
| `cross-document.spec.ts` | Cross-document fixture; built distribution | Chromium; real mouse | `gestures`, `log`; verifies owner-document layout, theme lookup, opening, and selection |
| `default-theme-colors.spec.ts` | Main fixture; built distribution | Chromium; real mouse and Playwright color-scheme emulation | `gestures`; checks computed stroke and wedge colors after the production Lightning CSS build |
| `deployed-demo.spec.ts` | Assembled `demo-dist/` site | Dedicated Chromium; real mouse | `gestures`; checks the deployed import map/site wiring and a real selection |
| `dispatch-ordering.spec.ts` | Main fixture; built distribution | Chromium; real mouse | `gestures`; creates its own controller and observes DOM state inside `open`, `change`, and `select` listeners |
| `disposal.spec.ts` | Main fixture; built distribution | Chromium; real mouse | `gestures`; creates its own controller and checks disposal, repeated disposal, rendered cleanup, cursor restoration, and inert later input |
| `gesture-feedback-colors.spec.ts` | Main fixture; built distribution | Chromium; real mouse | `gestures`, `log`; checks computed custom colors for completed and canceled feedback traces |
| `layout-pointer-target.cross-browser.spec.ts` | Layout fixture; bundled internal source | Chromium, Firefox, and WebKit; real mouse clicks | `gestures`; checks SVG rectangle hit testing for a zero-thickness inner connector and a painted outer connector |
| `layout-pointer-target.spec.ts` | Layout fixture; bundled internal source | Chromium; real mouse clicks | `gestures`; checks wedge, plate, and gap hit regions |
| `mouse.cross-browser.spec.ts` | Main fixture; built distribution | Chromium, Firefox, and WebKit; real mouse gestures | `gestures`, `log`; covers novice, expert, startup, submenu, cancellation, pointer capture, label layout, wedge/connector geometry, default prevention, and text selection |
| `multiple-controllers.spec.ts` | Main fixture; built distribution | Chromium; no synthetic input | Page-side setup only; checks shared `touch-action` claims and exact restoration |
| `standalone-keyboard.spec.ts` | Main fixture; built distribution | Chromium; real keyboard | Local setup helper; checks directional focus, submenu entry/backtracking, Enter, Escape, Tab, focus restoration, and hotkey isolation |
| `standalone-pointer.spec.ts` | Main fixture; built distribution | Chromium; real mouse plus synthetic `pointerType: 'touch'` and `'pen'` events | Local setup helpers; checks hover, click, drag-out, outside dismissal, submenu focus, shadow-root nesting, iframe nesting, and pointer-type neutrality |
| `stroke-live-theme.spec.ts` | Main fixture; built distribution | Chromium; real mouse | `gestures`; checks live CSS repaint without recreating the path element |
| `stroke-overflow.cross-browser.spec.ts` | Main fixture; built distribution | Chromium, Firefox, and WebKit; real mouse | `gestures`; checks paint and hit testing outside a visible-overflow parent and clipping under hidden overflow |
| `stroke-point-radius.cross-browser.spec.ts` | Main fixture; built distribution | Chromium, Firefox, and WebKit; real mouse | `gestures`; checks computed CSS `r` on the SVG origin marker |
| `touch-action.touch.spec.ts` | Main fixture; built distribution | Touch Chromium; genuine touch through the Chrome DevTools Protocol | `gestures`, `log`, `touch`; checks computed `touch-action` and expert touch selection |

The synthetic touch and pen cases in `standalone-pointer.spec.ts` are
intentional: they test that the controller does not branch on `pointerType`.
They do not test native touch behavior, implicit capture, or browser gesture
handling. The two `*.touch.spec.ts` files do.

## Behavioral overlap

An overlap here means that at least one assertion covers the same behavior.
It does not mean the files are interchangeable: many Playwright assertions add
real input, layout, CSS, another browser engine, a nested document, or the
built artifact.

| Playwright spec | Overlap in the current jsdom project | Overlap in the existing Vitest browser project |
| --- | --- | --- |
| `concurrent-pointers.touch.spec.ts` | `src/engine/gesture-pointer-source.test.ts` rejects movement, release, and cancellation from a non-owning pointer; `src/engine/controller.test.ts` checks primary-pointer ownership and capture | No multi-contact equivalent |
| `cross-document.spec.ts` | No cross-document equivalent | No cross-document equivalent |
| `default-theme-colors.spec.ts` | `src/layout/menu.test.ts` checks custom-property reads with a style stub, but not default production CSS or Lightning CSS output | `src/menu.browser.test.ts` checks several theme tokens and screenshots; it does not replace the built-CSS regression |
| `deployed-demo.spec.ts` | None | None; it is the only assembled-site check |
| `dispatch-ordering.spec.ts` | `src/engine/controller.test.ts` checks rendered state before `select` dispatch and batched render/event changes; `src/engine/runtime.test.ts` checks output order | No exact equivalent |
| `disposal.spec.ts` | `src/engine/controller.test.ts` checks listener, DOM, cursor, pointer-capture, and touch-action cleanup plus idempotence; renderer, focus, and pointer-source suites check their own teardown | No controller-boundary equivalent |
| `gesture-feedback-colors.spec.ts` | `src/layout/gesture-feedback.test.ts` and `src/engine/renderer.test.ts` check trace lifetime, classes, and concurrency, but not computed theme colors | `src/menu.browser.test.ts` has concurrent feedback screenshots |
| `layout-pointer-target.cross-browser.spec.ts` | `src/layout/menu.test.ts` checks pointer-target state and event resolution, but jsdom cannot perform painted SVG hit testing | `src/menu.standalone.browser.test.ts` checks that the menu becomes a pointer target; it does not isolate both connector regions across engines |
| `layout-pointer-target.spec.ts` | `src/layout/menu.test.ts` checks enabled/disabled pointer targets and synthetic event resolution | `src/menu.standalone.browser.test.ts` checks the high-level pointer target and cursor |
| `mouse.cross-browser.spec.ts` | Strong overlap with `src/create-marking-menu.integration.test.ts`, `src/engine/controller.test.ts`, `src/engine/gesture-pointer-source.test.ts`, both machine suites, and `src/layout/menu.test.ts` for gesture outcomes, dwell transitions, submenu paths, cancellation, capture, and geometry | `src/menu.browser.test.ts` covers open/active/close visuals, stroke/feedback, overflow, and submenu rendering; the Playwright spec still adds Firefox/WebKit and real mouse behavior |
| `multiple-controllers.spec.ts` | `src/move/touch-action.test.ts` checks reference-counted claims and exact restoration; `src/engine/controller.test.ts` checks two controllers sharing a parent | No exact equivalent |
| `standalone-keyboard.spec.ts` | `src/engine/machine.standalone.test.ts`, `src/engine/standalone-session.test.ts`, and `src/engine/controller.standalone.test.ts` cover the same navigation, focus, submenu, close, and restore paths | `src/menu.standalone.browser.test.ts` now covers these flows with real browser focus and keyboard input and is the closest duplicate |
| `standalone-pointer.spec.ts` | The standalone machine, session, and controller suites cover hover, activation, outside press, drag-out, submenu focus, capture, shadow paths, and focus restoration; iframe ownership has no jsdom equivalent | `src/menu.standalone.browser.test.ts` covers the top-document mouse/touch flows; the Playwright iframe and shadow-root cases add nesting coverage |
| `stroke-live-theme.spec.ts` | `src/layout/menu.test.ts` checks style-token reads and `src/engine/renderer.test.ts` checks node identity across renders, but neither observes a real cascade repaint | `src/menu.browser.test.ts` checks another live theme change on the opening indicator; it does not assert stroke-node identity |
| `stroke-overflow.cross-browser.spec.ts` | No real-layout equivalent | `src/menu.browser.test.ts` has both visible- and hidden-overflow cases and is the closest duplicate, though it currently runs only Chromium |
| `stroke-point-radius.cross-browser.spec.ts` | `src/layout/stroke.test.ts` checks marker creation and reuse, not computed CSS geometry | `src/menu.browser.test.ts` captures the origin marker visually; it does not read CSS `r` across engines |
| `touch-action.touch.spec.ts` | `src/engine/gesture-pointer-source.test.ts` and `src/move/touch-action.test.ts` check the inline claim; controller and machine tests check expert selection | Browser gesture tests exercise touch-driven menu behavior, but no existing Vitest browser test combines the computed claim with an expert touch selection |

## Facts that constrain the later plan

- Moving the 16 pure runtime suites and 10 type-level suites does not require a
  browser harness.
- Moving the DOM suites without preserving their current stubs would change
  their meaning. A real browser can replace the label-size and computed-style
  stubs, but tests that deliberately choose coordinates or capture state may
  still need explicit fixtures.
- The two global setup shims for `part` and `matchMedia` are already unused.
  Removing them is independent of porting any test.
- `src/layout/raf-throttle.test.ts` is the only environment edge case: it is
  DOM-free but browser-scheduler-dependent.
- The Playwright suite is not merely a second copy of the unit suite. Its
  unique coverage is the built output, the assembled demo, Firefox/WebKit,
  native touch, computed CSS/layout/hit testing, overflow, and cross-document
  behavior.
- The closest whole-file duplicates are the standalone keyboard and pointer
  specs versus `src/menu.standalone.browser.test.ts`, and the overflow spec
  versus the two overflow cases in `src/menu.browser.test.ts`.
