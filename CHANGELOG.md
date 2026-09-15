# Changelog

## 1.0.0

### Major Changes

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Stop assigning generated positional IDs to menu items. Items without a
  caller-provided ID now expose `id: undefined`; provide an explicit ID when an
  item must be addressed by ID. Positional identity is available separately as
  the library-assigned `key` property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Rename `getChildrenByName()` to `getChildrenByLabel()` on emitted menu items.

- [#311](https://github.com/QuentinRoy/Marking-Menu/pull/311) [`999feaf`](https://github.com/QuentinRoy/Marking-Menu/commit/999feaf2021ab5a06d7fe42304d69fa979a028b8) - Size label plates to their text by default. Set both `--mm-plate-min-width`
  and `--mm-plate-max-width` to `120px` to keep the prior fixed, truncated
  plate. Plate height now follows its label, so `--mm-plate-height` no longer
  applies.
  Active plates remain centered on their resting position as their label style
  changes.
  All plate corners now use `--mm-plate-corner-radius`, and plate padding now
  defaults to `12px` where `text-box-trim` and `text-box-edge` are available.
  Browsers without trimming add `0.2em` to the default or configured padding.
  The default label font size is `20px`, and the horizontal clearance between
  plates defaults to `12px`.
  Rename `--item-background`, `--item-color`, `--active-item-background`, and
  `--active-item-color` to the corresponding `--mm-plate-*` properties.

- [#233](https://github.com/QuentinRoy/Marking-Menu/pull/233) [`ab83b8b`](https://github.com/QuentinRoy/Marking-Menu/commit/ab83b8bede215758236a79640d956dfa8b80470e) - `createMarkingMenu` no longer returns an RxJS `Observable`. It returns an
  already-active controller: listen with `controller.on(type, listener)` and
  stop the menu with `controller.dispose()` (or `[Symbol.dispose]()`, for
  `using`).

  Six events replace the old notification stream: `start`, `open`, `move`,
  `change`, `select`, and `cancel`. `move` now fires in every mode, so `draw`
  is gone; `cancel`'s `selection` field is renamed `active`, and is always
  present. Where you used to do this:

  ```js
  const subscription = createMarkingMenu({ items, parent }).subscribe(
    (selection) => console.log(selection.label),
  );
  subscription.unsubscribe();
  ```

  do this instead:

  ```js
  const menu = createMarkingMenu({ items, parent });
  menu.on('select', (event) => console.log(event.selection.label));
  menu.dispose();
  ```

  `notifySteps`, `MarkingMenuNotification`, `exportNotification`, and the
  conditional result type it produced are gone along with it: every controller
  now dispatches the full event set, so a consumer who only wants selections
  listens for `select` and ignores the rest.

- [#144](https://github.com/QuentinRoy/Marking-Menu/pull/144) [`1580c6e`](https://github.com/QuentinRoy/Marking-Menu/commit/1580c6e1b4e4a5e5d877d7047e4262c011684229) - Ship a single ES module entry point at `dist/index.js`. Remove the UMD
  artifact, including its CommonJS, AMD, and `window.MarkingMenu` loading paths,
  and remove the former `marking-menu.mjs` entry point. Browser consumers must
  now load the package as an ES module.

- [#145](https://github.com/QuentinRoy/Marking-Menu/pull/145) [`4c70277`](https://github.com/QuentinRoy/Marking-Menu/commit/4c702773c5acd65ffbbf024af5ced37e54ac3b02) - Return `null` from `getNearestChild()` when an emitted menu item has no
  sub-items, instead of throwing.

- [#260](https://github.com/QuentinRoy/Marking-Menu/pull/260) [`195d2dd`](https://github.com/QuentinRoy/Marking-Menu/commit/195d2ddbbb670ef365b26ef6b14dffe59fa76ed7) - 5-, 6-, and 7-item menus now position items evenly around the circle. The
  upgrade raises no error and does not fail builds, but a learned gesture can
  select a different item. Set each item's `angle` to keep its existing direction.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Return `null` instead of `undefined` from `getChild()` when no direct sub-item
  has the requested ID. Calling `getChild()` on a leaf now also returns `null`
  instead of throwing.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the `isLeaf()` method on emitted menu items with an `isLeaf` boolean
  property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the `isRoot()` method on emitted menu items with an `isRoot` boolean
  property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Rename the menu item `name` property to `label`.

- [#227](https://github.com/QuentinRoy/Marking-Menu/pull/227) [`1efeece`](https://github.com/QuentinRoy/Marking-Menu/commit/1efeece5c301460bd9fe87d0245a4211482f78b0) - Return `null` instead of `undefined` from the root's `parent` property.
  Items' `parent` is now precisely typed: for a model built from a literal
  menu description, it resolves to the exact ancestor node instead of a loose
  one. `AnyModelNode`, `MarkingMenuModelItem` and `ModelRoot` gain the field
  in their types, so any code implementing or mocking one of them needs to
  supply it.

- [#277](https://github.com/QuentinRoy/Marking-Menu/pull/277) [`ca594cd`](https://github.com/QuentinRoy/Marking-Menu/commit/ca594cd63f7d876da3515640d11d3aaa8c88bd50) - Raise the default `submenuOpeningDelay` from 100 to `1000 / 3`, matching
  `noviceDwellingTime`, so showing the menu and opening a submenu take the
  same pause.

- [#145](https://github.com/QuentinRoy/Marking-Menu/pull/145) [`4c70277`](https://github.com/QuentinRoy/Marking-Menu/commit/4c702773c5acd65ffbbf024af5ced37e54ac3b02) - Raise the browser build target to Chrome and Edge 111, Firefox 114, and
  Safari and iOS 16.4 or newer.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the default `MarkingMenu` export with the named `createMarkingMenu`
  export. Update imports and calls accordingly:

  ```js
  import { createMarkingMenu } from 'marking-menu';

  const menu$ = createMarkingMenu({ items, parent });
  ```

- [#188](https://github.com/QuentinRoy/Marking-Menu/pull/188) [`fe933d7`](https://github.com/QuentinRoy/Marking-Menu/commit/fe933d7845cb268dddf1ea29ecccf4c7e0f223f7) - Narrow `MarkingMenuLogger` to `error`, now taking a single `Error` argument
  rather than varargs of `unknown`. Errors are normalized before reaching it, so
  a handler typed to expect an `Error` can be passed directly. `info`, `warn`
  and `debug` become optional and ignored, since nothing in the library ever
  called them. `console` still satisfies the type, and `log` can still be
  overridden partially. Three things break: a logger whose `error` expects
  something other than (or in addition to) an `Error`, a logger whose `error`
  declares two or more required parameters, and any code that imported
  `MarkingMenuLogger` to call `.info()`, `.warn()` or `.debug()` on it.

- [#129](https://github.com/QuentinRoy/Marking-Menu/pull/129) [`25c0a37`](https://github.com/QuentinRoy/Marking-Menu/commit/25c0a371f30676fa730f1854a793c6502e30058d) - Remove the string shorthand for menu items. Every menu item must now be an
  object.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Pass a single configuration object to `createMarkingMenu` instead of using
  positional arguments: `createMarkingMenu({ items, parent, ...options })`.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Expose sub-items of emitted selection items as `items` instead of `children`.

- [#302](https://github.com/QuentinRoy/Marking-Menu/pull/302) [`6ca5e42`](https://github.com/QuentinRoy/Marking-Menu/commit/6ca5e42d1dac54243bf6449a68a6a84d0278301f) - Render menus in an open shadow root on the existing `.marking-menu` wrapper.
  Page-level legacy class selectors no longer reach the menu. Replace the label
  and connector theme properties with the `--mm-*` names. Internal menu elements
  are not a styling API. Use `--mm-outer-connector-color-active` when the active
  outer connector should differ from its resting color.

  Replace `--mm-ring-radius` with `--mm-wedge-thickness`. The default is 40px,
  which sets the radial thickness beyond `deadZoneRadius`.

  The center-to-wedge connector is transparent by default. Set
  `--mm-inner-connector-color` to show it; use `--mm-outer-connector-color` for
  the wedge-to-plate connector.

- [#277](https://github.com/QuentinRoy/Marking-Menu/pull/277) [`ca594cd`](https://github.com/QuentinRoy/Marking-Menu/commit/ca594cd63f7d876da3515640d11d3aaa8c88bd50) - Replace `minSelectionDist` and `minMenuSelectionDist` with a single
  `deadZoneRadius` option, defaulting to 40. An item becomes active once the
  pointer leaves that radius, and pausing on it there opens its submenu. The
  band between the two old distances, where an item was active but a pause did
  nothing, is gone. TypeScript rejects the old names; JavaScript callers
  passing them get no warning and no effect.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Define submenus with `items` instead of `children`.

- [#145](https://github.com/QuentinRoy/Marking-Menu/pull/145) [`4c70277`](https://github.com/QuentinRoy/Marking-Menu/commit/4c702773c5acd65ffbbf024af5ced37e54ac3b02) - Rename the `subMenuOpeningDelay` configuration option to
  `submenuOpeningDelay`.

- [#335](https://github.com/QuentinRoy/Marking-Menu/pull/335) [`6bb1c6c`](https://github.com/QuentinRoy/Marking-Menu/commit/6bb1c6c19b8bb51d818f728f3b6fead27b812d9e) - Gesture strokes can now paint outside their parent so they follow the same
  overflow behavior as the menu.

  Set `overflow: hidden` on the parent when the menu and strokes must stay within
  it, and use the `--mm-stroke-*` custom properties instead of the removed stroke
  options.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Require caller-provided item IDs to be unique across the entire menu tree.
  Duplicate literal IDs are rejected by TypeScript, and duplicate IDs in
  dynamically built menus throw when the menu is created.

- [#304](https://github.com/QuentinRoy/Marking-Menu/pull/304) [`f8594c1`](https://github.com/QuentinRoy/Marking-Menu/commit/f8594c15bee8e3f9a5cacd8bf51f55fcba0b9a0b) - Render each menu item as a wedge in a configurable ring. Wedges follow the
  menu's selection regions and use constant-width gaps. Style them with the
  `--mm-wedge-*` custom properties.

### Minor Changes

- [#234](https://github.com/QuentinRoy/Marking-Menu/pull/234) [`fc86a4e`](https://github.com/QuentinRoy/Marking-Menu/commit/fc86a4e7bf42a0f8ec8d1712452a480b74b78a9d) - `rxjs` is gone: not a dependency, not a peer dependency, not a runtime
  import. Events reach you through the controller's plain `on`/`dispose` API
  with nothing to install or pin a compatible version of.

- [#261](https://github.com/QuentinRoy/Marking-Menu/pull/261) [`b93d497`](https://github.com/QuentinRoy/Marking-Menu/commit/b93d497f6e7ba9bbd5d97941e0c836395dfa6f68) - Let items set an optional clockwise `angle` in degrees. Items without an
  angle fill the gaps between stated angles. Menu construction rejects a level
  with less than 45 degrees between neighboring items. The generated corpus
  recognizes 45-degree menus at 90.4% accuracy and 40-degree menus at 61.2%.

- [#290](https://github.com/QuentinRoy/Marking-Menu/pull/290) [`1b2b563`](https://github.com/QuentinRoy/Marking-Menu/commit/1b2b563de130a3e4290fa4159c81f133b5bc850e) - Labels now solve a compact, conflict-free layout when a menu is created
  instead of sitting at a fixed shared radius. Item directions, cyclic order,
  and gesture mapping are unchanged; only where each label renders relative to
  that direction can shift. A menu stays laid out for its lifetime; recreate
  it (as this library already does on item, label, font, or style changes) to
  relayout.

- [#189](https://github.com/QuentinRoy/Marking-Menu/pull/189) [`bffd5aa`](https://github.com/QuentinRoy/Marking-Menu/commit/bffd5aa840c29a61f854fb144d1b922c1ef7bb99) - Export the public event classes and typed, listen-only emitter facade that
  the upcoming native event-based API will use: `MarkingMenuStartEvent`,
  `MarkingMenuOpenEvent`, `MarkingMenuMoveEvent`, `MarkingMenuChangeEvent`,
  `MarkingMenuSelectEvent`, `MarkingMenuCancelEvent`, their shared
  `MarkingMenuEventBase`, the `MarkingMenuEventMap`/`MarkingMenuEvent` types, and
  `MarkingMenuEventEmitter`.

  These events are plain classes, not DOM `Event`s: this library has no DOM
  target, bubbling, or default action to prevent, so there is none of that
  machinery to carry around. `MarkingMenuEventEmitter` is listen-only: `on`/`off`
  narrowed per event name, with no listener options (once/signal/capture) and no
  `dispatch`/`emit` in the type at all.

- [#370](https://github.com/QuentinRoy/Marking-Menu/pull/370) [`aa25858`](https://github.com/QuentinRoy/Marking-Menu/commit/aa25858d399ab7befca64ac6ca49f7ff81e8e39e) - Expose the menu to assistive technologies. The menu has the `menu` role and each item the `menuitem` role, named by its label. Items with a submenu set `aria-haspopup="menu"`. Wedges, connectors, strokes, and the opening indicator are hidden from the accessibility tree. The menu and its items are focusable from script but stay out of the Tab order.

- [#345](https://github.com/QuentinRoy/Marking-Menu/pull/345) [`55d8361`](https://github.com/QuentinRoy/Marking-Menu/commit/55d83611a26bdbacebd13b97a264fd70c5e14841) - Show a growing dot inside a background circle to signal that a menu (or
  submenu) is about to open, appearing during the pause before it does. The
  dot fills the circle exactly as the menu opens, becoming its start marker
  with no visible jump. Style it with the new `--mm-indicator-fill` and
  `--mm-indicator-background` custom properties; the background defaults to
  a light gray, distinct from the wedge fill, so the growing dot stays
  visible against it, with its own dark-mode variant.

- [#383](https://github.com/QuentinRoy/Marking-Menu/pull/383) [`1c836d8`](https://github.com/QuentinRoy/Marking-Menu/commit/1c836d800c45a8b5d5873cf608020a8bb6e2377c) - The menu now moves real focus during a gesture, so a screen reader announces the active item. Opening a menu (or a submenu) focuses its container; the active item takes focus once it has stayed active for 50ms. Selecting or canceling gives focus back to whatever held it before the gesture started.

- [#150](https://github.com/QuentinRoy/Marking-Menu/pull/150) [`c7ad8ad`](https://github.com/QuentinRoy/Marking-Menu/commit/c7ad8adf834abe13cf3f1d76504b499e4ea3a186) - Migrate drag handling to Pointer Events with pointer capture, explicit gesture cancellation, reliable touch-action management, and complete listener and inner-observable teardown.

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Ship TypeScript type declarations. Emitted selections are typed from the items
  passed to `createMarkingMenu()`, so their `id` and `label` narrow to the exact
  values described, instead of being `unknown`.

- [#348](https://github.com/QuentinRoy/Marking-Menu/pull/348) [`a1e36a8`](https://github.com/QuentinRoy/Marking-Menu/commit/a1e36a8e1080eb71a754e6c9baa60a21d829c026) - The library's own default colors use `hwb()` instead of hex, matching
  the color notation used throughout the README.

  Plate background and label color default to a darker `hwb(0 58% 42%)`
  and white instead of near-white and dark gray; wedges and outer
  connectors mirror the plate background, using the new
  `--mm-fill-color` and `--mm-fill-color-active` properties. Activating an
  item nudges the fill a touch darker in light mode, and a touch lighter
  in dark mode. Colors pick a dark-mode variant using `light-dark()` once
  the host page opts in with `color-scheme`.

  `--mm-wedge-outline-*` and `--mm-plate-outline-*`, each with its own
  `-active` variant, let a host draw an inset outline instead of the fill.
  Both fall back to the new `--mm-outline-color`, `--mm-outline-color-active`,
  and `--mm-outline-width`, shared between wedges and plates; every width
  defaults to `0`, off.

### Patch Changes

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Remove the `raf-schd` dependency, replaced with an equivalent internal
  implementation. No behavior change; `raf-schd` just no longer shows up in
  consumers' `node_modules` or dependency audits.

- [#254](https://github.com/QuentinRoy/Marking-Menu/pull/254) [`db527e4`](https://github.com/QuentinRoy/Marking-Menu/commit/db527e4eb84e6cc6cf8a784898e7c8407daf7056) - Lay the menu out correctly on a page that resets `box-sizing`. The menu's
  stylesheet sizes an item's label by its content and pads around it, and its
  positioning arithmetic adds that padding back. Under a host reset making
  everything `border-box`, as Tailwind's preflight and normalize both do, the
  padding came out of the label instead, leaving its text off centre and its
  box off position. The menu now states the box model it assumes.

- [#262](https://github.com/QuentinRoy/Marking-Menu/pull/262) [`3d2d200`](https://github.com/QuentinRoy/Marking-Menu/commit/3d2d200ca84400b62108d17a1ca75b27ce527f74) - Stop using `innerHTML` to render menu item labels. A label containing markup
  now shows as plain text instead of being parsed as HTML.

- [#344](https://github.com/QuentinRoy/Marking-Menu/pull/344) [`7e7b3fb`](https://github.com/QuentinRoy/Marking-Menu/commit/7e7b3fb0adb9011dcae285705b5c971b567c2307) - Support rendering the menu into an element owned by a different document, such as an iframe.

- [#253](https://github.com/QuentinRoy/Marking-Menu/pull/253) [`7d6704b`](https://github.com/QuentinRoy/Marking-Menu/commit/7d6704be67fd79cf13b379a91e77be158b9cc4c6) - Draw strokes relative to the parent rather than to the viewport. The renderer
  already placed the menu relative to its parent, but passed the stroke, its
  origin marker and the completed-gesture trace straight through in the client
  coordinates they arrive in, so all three were offset by the parent's own
  position. Only a parent at the viewport's top-left was unaffected.

All notable changes to this project will be documented in this file. Entries are generated from [Changesets](https://github.com/changesets/changesets) — see `.changeset/README.md` for how to add one.

## [0.10.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.10.0...v0.10.1) (2026-07-22)

### Minor Changes

- [#113](https://github.com/QuentinRoy/Marking-Menu/issues/113) [`f0a870d`](https://github.com/QuentinRoy/Marking-Menu/commit/f0a870d596f05c8ca6722fe68326f07860037708) - migrate GitHub Pages deployment to Actions and ESM demo
- [#112](https://github.com/QuentinRoy/Marking-Menu/issues/112) [`3723cf4`](https://github.com/QuentinRoy/Marking-Menu/commit/3723cf4a7988ed6966ea58af336ae99c4d3df9ba) - publish native ESM build alongside UMD

### Patch Changes

- [#115](https://github.com/QuentinRoy/Marking-Menu/issues/115) [`f0d9c95`](https://github.com/QuentinRoy/Marking-Menu/commit/f0d9c95501b9a8a0e340eee93a4a68e1ad4855dc) - scope Jest tests to source
- [#110](https://github.com/QuentinRoy/Marking-Menu/issues/110) [`f553c5a`](https://github.com/QuentinRoy/Marking-Menu/commit/f553c5a6aa902dca35f8c7f683bf07c67ed339e2) - use event timestamp for open notifications

## [0.10.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0...v0.10.0) (2022-04-08)

### Major Changes

- CSS is now bundled with JS and does not have to be imported separately.
- rxjs 6 is not supported anymore

### Minor Changes

- [`64c2656`](https://github.com/QuentinRoy/Marking-Menu/commit/64c2656a5836deae4823d8214faf48192ffc5073) - increase submenu opening delay
- [`41c386f`](https://github.com/QuentinRoy/Marking-Menu/commit/41c386fdc11b7e023c1fa44487e79396aa9f3381) - upgrade jest and rxjs

### Patch Changes

- [`4c57509`](https://github.com/QuentinRoy/Marking-Menu/commit/4c57509e20f6b5595e24b094ef0dfb473cf17c5a) - fix rxjs peer dep version
- [`cec3474`](https://github.com/QuentinRoy/Marking-Menu/commit/cec34747e2c175d28e4d3230503c59c80238d7ba) - remove scss, use css variables and bundle css with js export

## [0.9.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.1...v0.9.0) (2018-10-01)

### Minor Changes

- [#41](https://github.com/QuentinRoy/Marking-Menu/issues/41) [`81de0fb`](https://github.com/QuentinRoy/Marking-Menu/commit/81de0fb) - different feedback on cancel, closes [#32](https://github.com/QuentinRoy/Marking-Menu/issues/32)
- [#34](https://github.com/QuentinRoy/Marking-Menu/issues/34) [`51b3619`](https://github.com/QuentinRoy/Marking-Menu/commit/51b3619) - expert to novice transition

## [0.9.0-beta.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.0...v0.9.0-beta.1) (2018-09-26)

## [0.9.0-beta.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.2...v0.9.0-beta.0) (2018-08-24)

### Minor Changes

- [`750ecbe`](https://github.com/QuentinRoy/Marking-Menu/commit/750ecbe) - feedback on gestures upon selection, closes [#2](https://github.com/QuentinRoy/Marking-Menu/issues/2)
- [`b204857`](https://github.com/QuentinRoy/Marking-Menu/commit/b204857) - lower stroke shows pas movements under a menu

### Patch Changes

- [#26](https://github.com/QuentinRoy/Marking-Menu/issues/26) [`62360ad`](https://github.com/QuentinRoy/Marking-Menu/commit/62360ad) - fix strokeColor option

## [0.8.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.1...v0.8.2) (2018-06-29)

## [0.8.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0...v0.8.1) (2018-04-28)

### Patch Changes

- [`1c7d72c`](https://github.com/QuentinRoy/Marking-Menu/commit/1c7d72c) - fix rxjs peer dependency

## [0.8.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0-alpha.0...v0.8.0) (2018-04-28)

## [0.8.0-alpha.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.1...v0.8.0-alpha.0) (2018-04-28)

### Minor Changes

- [`7f79831`](https://github.com/QuentinRoy/Marking-Menu/commit/7f79831) - support for custom logger

### Patch Changes

- [`dbc7e56`](https://github.com/QuentinRoy/Marking-Menu/commit/dbc7e56) - fix broken css build due to differui/rollup-plugin-sass[#42](https://github.com/QuentinRoy/Marking-Menu/issues/42)
- [`149e26b`](https://github.com/QuentinRoy/Marking-Menu/commit/149e26b) - make sure dwelling does not emit the last events on completion
- [`2691aa5`](https://github.com/QuentinRoy/Marking-Menu/commit/2691aa5) - update to rxjs6

## [0.7.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.0...v0.7.1) (2017-08-02)

### Patch Changes

- [`3838cc4`](https://github.com/QuentinRoy/Marking-Menu/commit/3838cc4) - Fix inconsistent open notifications.

## [0.7.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.1...v0.7.0) (2017-08-02)

### Major Changes

- [`e683d0f`](https://github.com/QuentinRoy/Marking-Menu/commit/e683d0f) - Rename notifications' `center` property to `menuCenter`.

### Minor Changes

- [`3547121`](https://github.com/QuentinRoy/Marking-Menu/commit/3547121) - Export timestamp with notifications.

## [0.6.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.0...v0.6.1) (2017-08-01)

### Patch Changes

- [`79fbf2f`](https://github.com/QuentinRoy/Marking-Menu/commit/79fbf2f) - Fix sub-menus positioning.

## [0.6.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.3...v0.6.0) (2017-08-01)

### Minor Changes

- [`8529971`](https://github.com/QuentinRoy/Marking-Menu/commit/8529971) - Addition of the notifySteps options.

### Patch Changes

- [`91fc285`](https://github.com/QuentinRoy/Marking-Menu/commit/91fc285) - Fix duplication of the first stroke notification.
- [`a9ace25`](https://github.com/QuentinRoy/Marking-Menu/commit/a9ace25) - Fix menu open notification(s)
- [`b9a76eb`](https://github.com/QuentinRoy/Marking-Menu/commit/b9a76eb) - Fix navigation start argument not being properly took into account.
- [`ec46e68`](https://github.com/QuentinRoy/Marking-Menu/commit/ec46e68) - Fix various inconsistent type of notification.
- [`c988723`](https://github.com/QuentinRoy/Marking-Menu/commit/c988723) - Protect the model against mutations.

## [0.5.3](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.2...v0.5.3) (2017-07-31)

### Patch Changes

- [`19b9fd3`](https://github.com/QuentinRoy/Marking-Menu/commit/19b9fd3) - Fix crash on tap/click., closes [#1](https://github.com/QuentinRoy/Marking-Menu/issues/1)

## [0.5.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.1...v0.5.2) (2017-07-29)

### Patch Changes

- [`bbffb8c`](https://github.com/QuentinRoy/Marking-Menu/commit/bbffb8c) - Fix DOM not being properly cleaned upon un-subscription of the observable.

## [0.5.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.0...v0.5.1) (2017-07-28)

### Patch Changes

- [`f5e6ca1`](https://github.com/QuentinRoy/Marking-Menu/commit/f5e6ca1) - Fix stroke shimmering on safari.

## [0.5.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.4.0...v0.5.0) (2017-07-28)

### Major Changes

- [`cd486ad`](https://github.com/QuentinRoy/Marking-Menu/commit/cd486ad) - Marking Menu's observable must now be subscribed to be effective and will be disabled once unsubscribed.

### Minor Changes

- [`89e2b27`](https://github.com/QuentinRoy/Marking-Menu/commit/89e2b27) - Draw stroke.

### Patch Changes

- [`dc86b34`](https://github.com/QuentinRoy/Marking-Menu/commit/dc86b34) - Fix the beginning of expert strokes being lost.
- [`c4cbc9f`](https://github.com/QuentinRoy/Marking-Menu/commit/c4cbc9f) - Make sure the stroke is cleared upon completion.

## [0.4.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.3.0...v0.4.0) (2017-07-28)

### Minor Changes

- [`048b439`](https://github.com/QuentinRoy/Marking-Menu/commit/048b439) - Expert / novice navigation mode switching.
- [`7cb9f96`](https://github.com/QuentinRoy/Marking-Menu/commit/7cb9f96) - Gesture recognizer.

## [0.3.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.2.0...v0.3.0) (2017-07-22)

### Minor Changes

- [`c96cc70`](https://github.com/QuentinRoy/Marking-Menu/commit/c96cc70) - **menu:** Change menu design.
- [`5ddeef0`](https://github.com/QuentinRoy/Marking-Menu/commit/5ddeef0) - Change menu radius.

### Patch Changes

- [`0235558`](https://github.com/QuentinRoy/Marking-Menu/commit/0235558) - Fix not working movements threshold.
- [`6233adc`](https://github.com/QuentinRoy/Marking-Menu/commit/6233adc) - Fix the whole observables chain being subscribed twice.
- [`8a10ae1`](https://github.com/QuentinRoy/Marking-Menu/commit/8a10ae1) - Prevent default drag behavior.

## [0.2.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.1...v0.2.0) (2017-07-21)

### Major Changes

- [`f93aa91`](https://github.com/QuentinRoy/Marking-Menu/commit/f93aa91) - Selection notifications do not directly gives the name of the selected item anymore but the corresponding model item.

### Minor Changes

- [`94bea34`](https://github.com/QuentinRoy/Marking-Menu/commit/94bea34) - **engine:** Introduce a minimum distance from the center to trigger a selection.
- [`2895f30`](https://github.com/QuentinRoy/Marking-Menu/commit/2895f30) - **model:** Support for children of items.
- [`3679393`](https://github.com/QuentinRoy/Marking-Menu/commit/3679393) - Support for multi-level marking menus.

## [0.1.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.0...v0.1.1) (2017-07-20)

### Patch Changes

- [`d1f50da`](https://github.com/QuentinRoy/Marking-Menu/commit/d1f50da) - Fix missing distributed files.

## 0.1.0 (2017-07-20)

### Minor Changes

- [`5aa198a`](https://github.com/QuentinRoy/Marking-Menu/commit/5aa198a) - **menu:** Make the root document configurable.
- [`e285594`](https://github.com/QuentinRoy/Marking-Menu/commit/e285594) - **menu:** Set active item by nearest angle.
- [`ff529f2`](https://github.com/QuentinRoy/Marking-Menu/commit/ff529f2) - Selection notifications.
- [`39a04f1`](https://github.com/QuentinRoy/Marking-Menu/commit/39a04f1) - Engine supporting 1-level Marking Menu.
- [`02f0b69`](https://github.com/QuentinRoy/Marking-Menu/commit/02f0b69) - Menu Layout.
