# Issue #402: Renderer fixed layer slots and one coordinate conversion: implementation-ready spec

Source proposal: [Give the renderer fixed layer slots and one coordinate conversion](https://github.com/QuentinRoy/Marking-Menu/issues/402).
Sibling scope boundary: [Style the opening indicator from CSS and drop the stroke theme probes](https://github.com/QuentinRoy/Marking-Menu/issues/403) stays separate (see Non-goals).
Baseline: `src/engine/renderer.test.ts` 7/7 green at time of writing.

## Destination

An implementation-ready spec for the renderer refactor. Stops before code: no implementation in this effort.

Done looks like: a scene inside the renderer owns fixed slots in paint order plus the single
page-to-local coordinate conversion; `restack`, `isPaintedBefore`, and the `coordinateParent`
plumbing are deleted; tests assert slot contents instead of guessing layers.

## Design decisions (locked)

1. **Slots:** 6 fixed slots in paint order: `lower` → `menu` → `indicator-background` →
   `upper` → `indicator-dot` → `feedback`. The feedback slot holds N traces in arrival order.
2. **Conversion:** the scene owns `getBoundingClientRect` + `toLocalPoint` and hands layers a
   late `convert()` they call at draw/tick time (preserves the current moved/scrolled-parent
   semantics of strokes-in-rAF and indicator-per-tick).
3. **SVG factory:** the scene owns a shared full-size SVG factory; `coordinateParent` is removed
   from layer options and layers mount into their given slots.
4. **Tests:** the spec defines a slot query API (`data-slot`); paint-order and coordinate tests are
   rewritten to assert slot contents.
5. **Scope:** indicator theming/probes (`createThemedIndicatorLayer`, `setStrokeTheme`,
   `MenuStrokeTheme`) are out of scope.

## New module: `src/engine/scene.ts`

A deep module: small interface, renderer owns one instance, tests cross its interface.

```ts
createScene({ root, parent }: { root: ShadowRoot; parent: HTMLElement }) => {
  slots: Record<'lower' | 'menu' | 'indicatorBackground' | 'upper' | 'indicatorDot' | 'feedback', HTMLElement>;
  toLocal: (p: Point) => Point;                    // fresh getBoundingClientRect() per call
  toLocalMany: (ps: readonly Point[]) => Point[];
  dispose: () => void;
};
```

- Slots are created once and appended to `root` in paint order. Each slot:
  `<div class="marking-menu-slot" data-slot="<name>">` with `display: contents`
  (no new box, so current absolute layout/CSS is unchanged; DOM order = paint order).
- `data-slot` names: `lower`, `menu`, `indicator-background`, `upper`, `indicator-dot`,
  `feedback`. This is the test query API.
- `parent` is the renderer's original container element. This unifies today's two spellings of
  the same element: `parent.host.parentElement` (`src/engine/renderer.ts`, persistent stroke
  layers and themed indicator layer) and `parent.getBoundingClientRect()` (menu center at render
  time, feedback at show time). Both refer to the container.
- `toLocal`/`toLocalMany` wrap `toLocalPoint` (`src/utils.ts`) and read the rect on every call
  (late conversion).
- `dispose()` removes the slots.

## Shared helper: `src/layout/svg-surface.ts` (new)

```ts
createFullSizeSvg(doc, slot, className) => SVGSVGElement;
```

- Appends to `slot` with the given class; positioning comes from the
  stylesheet (`.marking-menu-stroke-surface`, `.marking-menu-indicator-surface`
  in `menu.css`), so anything mounting a surface outside its reach, like the
  playground's recognizer overlay, positions the surface itself.
- Class names preserved: `marking-menu-stroke-surface` (+ variants),
  `marking-menu-indicator-surface`.
- `src/layout/stroke.ts` and `src/layout/indicator.ts` use it internally; their public
  `create*Surface` signatures stay unchanged so direct callers
  (`src/layout/stroke.test.ts`, `demo/playground/live-surface.tsx`) keep working.

## Changes per file

### `src/engine/renderer.ts`

- `createRenderer` creates the scene after `createMenuHost`, passes slots + `scene.toLocal`
  into the layer factories, and disposes the scene in `dispose()`.
- `createStrokeLayer({ slot, convert, surfaceOptions })`: SVG parent becomes `slot`; the rAF
  `draw` calls `convert` (keeps the moved/scrolled-parent semantics). Delete the
  `coordinateParent` parameter.
- `createIndicatorLayer({ backgroundSlot, dotSlot, convert, surfaceOptions })`: split today's
  single `parent` (both SVGs go to the same parent in `src/layout/indicator.ts`) into
  background/dot slots; `tick` calls `convert`. Delete `coordinateParent`.
- `createPersistentStrokeLayers` / `createThemedIndicatorLayer`: take slots + convert; delete
  both `parent.host.parentElement` lookups.
- `render(view)`: menu center and feedback strokes convert via `scene.toLocal`/`toLocalMany`
  eagerly (both draw synchronously with no rAF delay, so eager conversion is already late enough).
  Stroke/indicator layers convert lazily inside their draw/tick. Document this split and why it
  is safe.
- Delete `restack()` and `isPaintedBefore()` plus the per-render call. Paint order is now
  guaranteed by slot order in the DOM.
- Deletion test: `rg "restack|isPaintedBefore|coordinateParent" src/` returns nothing.

### `src/layout/menu.ts` (additive only)

- `createMenu({ parent, layerParent, ... })`: `parent` stays the `ShadowRoot` for
  styles/probes/queries; the menu `main` appends to `layerParent ?? parent`. The renderer passes
  the menu slot. Existing callers (`src/layout/menu.test.ts`,
  `demo/playground/layout-surface.tsx`, `e2e/fixture/layout.ts`) keep calling with `parent`
  only and are unaffected.
- `getItemDom`/`setActive`/`remove` unchanged (`main.remove()` detaches from the slot;
  `root.querySelectorAll` still finds items through the slot).

### `src/layout/gesture-feedback.ts` (additive)

- Takes the feedback `slot` as its DOM parent instead of the root. No convert inside (the
  renderer pre-converts). `elements()` still returns live traces; arrival order inside the slot
  replaces the old `place()` loop.

### `src/layout/stroke.ts`, `src/layout/indicator.ts`

- Use the shared factory; no behavior change.

## Tests

- Add a `slotOf(root, name)` helper querying `[data-slot="<name>"]`.
- Replace layer-guessing with slot assertions: lower path in `lower`, `.marking-menu-layer` in
  `menu`, background/dot in their slots, feedback traces in `feedback`; assert the root's slot
  order equals the 6 names.
- Update direct-children assumptions that break once SVGs nest in slots:
  `src/engine/renderer.test.ts` (SVG filter over `root.children`, layer map over
  `root.children`) and `src/engine/controller.test.ts` (`strokeSurfaces` filters
  `shadowRoot.children` for `svg.marking-menu-stroke-surface`) → query through slots instead.
  Descendant selectors elsewhere (`src/menu.browser.test.ts`, `e2e/tests/stroke-overflow.*`,
  `e2e/tests/mouse.*`, `e2e/tests/dispatch-ordering.*`) keep passing unchanged.
- Conversion: keep the existing client→parent test; add a moved-parent case (change the mocked
  rect between `sync` and the rAF/tick, assert the late rect wins) for stroke + indicator; add
  an eager-conversion case for menu center + feedback.
- Untouched behavior tests (host lifetime, dispose cancels frame/timer, indicator draw/remove,
  dot growth) stay as-is.

## Acceptance

- `rg "restack|isPaintedBefore|coordinateParent" src/` is empty.
- `yarn test src/engine/renderer.test.ts src/engine/controller.test.ts src/layout/` green;
  `yarn typecheck` and `yarn lint` green.
- No CSS changes; no e2e selector changes required.

## Out of scope

- Indicator theming cleanup (stroke theme probes, `createThemedIndicatorLayer` rebuild per menu)
  → owned by [Style the opening indicator from CSS and drop the stroke theme probes](https://github.com/QuentinRoy/Marking-Menu/issues/403).
- Menu focus targets, `pointerTarget`, config resolution, forced-colors, label-layout solver.
