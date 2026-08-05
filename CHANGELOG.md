# Changelog

## 1.0.0

### Major Changes

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Stop assigning generated positional IDs to menu items. Items without a
  caller-provided ID now expose `id: undefined`; provide an explicit ID when an
  item must be addressed by ID. Positional identity is available separately as
  the library-assigned `key` property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Rename `getChildrenByName()` to `getChildrenByLabel()` on emitted menu items.

- [#144](https://github.com/QuentinRoy/Marking-Menu/pull/144) [`1580c6e`](https://github.com/QuentinRoy/Marking-Menu/commit/1580c6e1b4e4a5e5d877d7047e4262c011684229) - Ship a single ES module entry point at `dist/index.js`. Remove the UMD
  artifact, including its CommonJS, AMD, and `window.MarkingMenu` loading paths,
  and remove the former `marking-menu.mjs` entry point. Browser consumers must
  now load the package as an ES module.

- [#145](https://github.com/QuentinRoy/Marking-Menu/pull/145) [`4c70277`](https://github.com/QuentinRoy/Marking-Menu/commit/4c702773c5acd65ffbbf024af5ced37e54ac3b02) - Return `null` from `getNearestChild()` when an emitted menu item has no
  sub-items, instead of throwing.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Return `null` instead of `undefined` from `getChild()` when no direct sub-item
  has the requested ID. Calling `getChild()` on a leaf now also returns `null`
  instead of throwing.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the `isLeaf()` method on emitted menu items with an `isLeaf` boolean
  property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the `isRoot()` method on emitted menu items with an `isRoot` boolean
  property.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Rename the menu item `name` property to `label`.

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

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Remove the `parent` property from emitted menu items.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Expose sub-items of emitted selection items as `items` instead of `children`.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Define submenus with `items` instead of `children`.

- [#145](https://github.com/QuentinRoy/Marking-Menu/pull/145) [`4c70277`](https://github.com/QuentinRoy/Marking-Menu/commit/4c702773c5acd65ffbbf024af5ced37e54ac3b02) - Rename the `subMenuOpeningDelay` configuration option to
  `submenuOpeningDelay`.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Require caller-provided item IDs to be unique across the entire menu tree.
  Duplicate literal IDs are rejected by TypeScript, and duplicate IDs in
  dynamically built menus throw when the menu is created.

### Minor Changes

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

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Include the opened (sub-)menu as `menu` on `open` notifications, when
  `notifySteps` is enabled. Notifications are also typed as a union discriminated
  on `type`, so checking `type` narrows the fields available on a notification.

- [#150](https://github.com/QuentinRoy/Marking-Menu/pull/150) [`c7ad8ad`](https://github.com/QuentinRoy/Marking-Menu/commit/c7ad8adf834abe13cf3f1d76504b499e4ea3a186) - Migrate drag handling to Pointer Events with pointer capture, explicit gesture cancellation, reliable touch-action management, and complete listener and inner-observable teardown.

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Ship TypeScript type declarations. Emitted selections are typed from the items
  passed to `createMarkingMenu()`, so their `id` and `label` narrow to the exact
  values described, instead of being `unknown`.

### Patch Changes

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Remove the `raf-schd` dependency, replaced with an equivalent internal
  implementation. No behavior change; `raf-schd` just no longer shows up in
  consumers' `node_modules` or dependency audits.

- [#150](https://github.com/QuentinRoy/Marking-Menu/pull/150) [`c7ad8ad`](https://github.com/QuentinRoy/Marking-Menu/commit/c7ad8adf834abe13cf3f1d76504b499e4ea3a186) - Replace deprecated RxJS test utilities with modern connectable observables.

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Report `mode` on every notification. Notifications emitted after a gesture
  turns into a novice-mode navigation previously carried no `mode` at all.

- [#141](https://github.com/QuentinRoy/Marking-Menu/pull/141) [`737bb95`](https://github.com/QuentinRoy/Marking-Menu/commit/737bb9562f45aaa3abe99722208847de740ddaba) - Resolve RxJS operators from the root `rxjs` entry point. Native ES module
  consumers can remove the `rxjs/operators` entry from their import maps.

All notable changes to this project will be documented in this file. Entries are generated from [Changesets](https://github.com/changesets/changesets) — see `.changeset/README.md` for how to add one.

### [0.10.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.10.0...v0.10.1) (2026-07-22)

### Features

- migrate GitHub Pages deployment to Actions and ESM demo ([#113](https://github.com/QuentinRoy/Marking-Menu/issues/113)) ([f0a870d](https://github.com/QuentinRoy/Marking-Menu/commit/f0a870d596f05c8ca6722fe68326f07860037708))
- publish native ESM build alongside UMD ([#112](https://github.com/QuentinRoy/Marking-Menu/issues/112)) ([3723cf4](https://github.com/QuentinRoy/Marking-Menu/commit/3723cf4a7988ed6966ea58af336ae99c4d3df9ba))

### Bug Fixes

- scope Jest tests to source ([#115](https://github.com/QuentinRoy/Marking-Menu/issues/115)) ([f0d9c95](https://github.com/QuentinRoy/Marking-Menu/commit/f0d9c95501b9a8a0e340eee93a4a68e1ad4855dc))
- use event timestamp for open notifications ([#110](https://github.com/QuentinRoy/Marking-Menu/issues/110)) ([f553c5a](https://github.com/QuentinRoy/Marking-Menu/commit/f553c5a6aa902dca35f8c7f683bf07c67ed339e2))

## [0.10.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0...v0.10.0) (2022-04-08)

### ⚠ BREAKING CHANGES

- CSS is now bundled with JS and does not have to be imported separately.
- rxjs 6 is not supported anymore

### Features

- increase submenu opening delay ([64c2656](https://github.com/QuentinRoy/Marking-Menu/commit/64c2656a5836deae4823d8214faf48192ffc5073))
- upgrade jest and rxjs ([41c386f](https://github.com/QuentinRoy/Marking-Menu/commit/41c386fdc11b7e023c1fa44487e79396aa9f3381))

### Bug Fixes

- fix rxjs peer dep version ([4c57509](https://github.com/QuentinRoy/Marking-Menu/commit/4c57509e20f6b5595e24b094ef0dfb473cf17c5a))

- remove scss, use css variables and bundle css with js export ([cec3474](https://github.com/QuentinRoy/Marking-Menu/commit/cec34747e2c175d28e4d3230503c59c80238d7ba))

<a name="0.9.0"></a>

# [0.9.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.1...v0.9.0) (2018-10-01)

### Features

- different feedback on cancel ([#41](https://github.com/QuentinRoy/Marking-Menu/issues/41)) ([81de0fb](https://github.com/QuentinRoy/Marking-Menu/commit/81de0fb)), closes [#32](https://github.com/QuentinRoy/Marking-Menu/issues/32)
- expert to novice transition ([#34](https://github.com/QuentinRoy/Marking-Menu/issues/34)) ([51b3619](https://github.com/QuentinRoy/Marking-Menu/commit/51b3619))

<a name="0.9.0-beta.1"></a>

# [0.9.0-beta.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.0...v0.9.0-beta.1) (2018-09-26)

<a name="0.9.0-beta.0"></a>

# [0.9.0-beta.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.2...v0.9.0-beta.0) (2018-08-24)

### Bug Fixes

- fix strokeColor option ([#26](https://github.com/QuentinRoy/Marking-Menu/issues/26)) ([62360ad](https://github.com/QuentinRoy/Marking-Menu/commit/62360ad))

### Features

- feedback on gestures upon selection ([750ecbe](https://github.com/QuentinRoy/Marking-Menu/commit/750ecbe)), closes [#2](https://github.com/QuentinRoy/Marking-Menu/issues/2)
- lower stroke shows pas movements under a menu ([b204857](https://github.com/QuentinRoy/Marking-Menu/commit/b204857))

<a name="0.8.2"></a>

## [0.8.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.1...v0.8.2) (2018-06-29)

<a name="0.8.1"></a>

## [0.8.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0...v0.8.1) (2018-04-28)

### Bug Fixes

- fix rxjs peer dependency ([1c7d72c](https://github.com/QuentinRoy/Marking-Menu/commit/1c7d72c))

<a name="0.8.0"></a>

# [0.8.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0-alpha.0...v0.8.0) (2018-04-28)

<a name="0.8.0-alpha.0"></a>

# [0.8.0-alpha.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.1...v0.8.0-alpha.0) (2018-04-28)

### Bug Fixes

- fix broken css build due to differui/rollup-plugin-sass[#42](https://github.com/QuentinRoy/Marking-Menu/issues/42) ([dbc7e56](https://github.com/QuentinRoy/Marking-Menu/commit/dbc7e56))
- make sure dwelling does not emit the last events on completion ([149e26b](https://github.com/QuentinRoy/Marking-Menu/commit/149e26b))
- update to rxjs6 ([2691aa5](https://github.com/QuentinRoy/Marking-Menu/commit/2691aa5))

### Features

- support for custom logger ([7f79831](https://github.com/QuentinRoy/Marking-Menu/commit/7f79831))

<a name="0.7.1"></a>

## [0.7.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.0...v0.7.1) (2017-08-02)

### Bug Fixes

- Fix inconsistent open notifications. ([3838cc4](https://github.com/QuentinRoy/Marking-Menu/commit/3838cc4))

<a name="0.7.0"></a>

# [0.7.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.1...v0.7.0) (2017-08-02)

### Features

- Export timestamp with notifications. ([3547121](https://github.com/QuentinRoy/Marking-Menu/commit/3547121))
- Rename notifications' `center` property to `menuCenter`. ([e683d0f](https://github.com/QuentinRoy/Marking-Menu/commit/e683d0f))

### BREAKING CHANGES

- Rename notifications' `center` property to `menuCenter`.

<a name="0.6.1"></a>

## [0.6.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.0...v0.6.1) (2017-08-01)

### Bug Fixes

- Fix sub-menus positioning. ([79fbf2f](https://github.com/QuentinRoy/Marking-Menu/commit/79fbf2f))

<a name="0.6.0"></a>

# [0.6.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.3...v0.6.0) (2017-08-01)

### Bug Fixes

- Fix duplication of the first stroke notification. ([91fc285](https://github.com/QuentinRoy/Marking-Menu/commit/91fc285))
- Fix menu open notification(s) ([a9ace25](https://github.com/QuentinRoy/Marking-Menu/commit/a9ace25))
- Fix navigation start argument not being properly took into account. ([b9a76eb](https://github.com/QuentinRoy/Marking-Menu/commit/b9a76eb))
- Fix various inconsistent type of notification. ([ec46e68](https://github.com/QuentinRoy/Marking-Menu/commit/ec46e68))
- Protect the model against mutations. ([c988723](https://github.com/QuentinRoy/Marking-Menu/commit/c988723))

### Features

- Addition of the notifySteps options. ([8529971](https://github.com/QuentinRoy/Marking-Menu/commit/8529971))

<a name="0.5.3"></a>

## [0.5.3](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.2...v0.5.3) (2017-07-31)

### Bug Fixes

- Fix crash on tap/click. ([19b9fd3](https://github.com/QuentinRoy/Marking-Menu/commit/19b9fd3)), closes [#1](https://github.com/QuentinRoy/Marking-Menu/issues/1)

<a name="0.5.2"></a>

## [0.5.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.1...v0.5.2) (2017-07-29)

### Bug Fixes

- Fix DOM not being properly cleaned upon un-subscription of the observable. ([bbffb8c](https://github.com/QuentinRoy/Marking-Menu/commit/bbffb8c))

<a name="0.5.1"></a>

## [0.5.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.0...v0.5.1) (2017-07-28)

### Bug Fixes

- Fix stroke shimmering on safari. ([f5e6ca1](https://github.com/QuentinRoy/Marking-Menu/commit/f5e6ca1))

<a name="0.5.0"></a>

# [0.5.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.4.0...v0.5.0) (2017-07-28)

### Bug Fixes

- Fix the beginning of expert strokes being lost. ([dc86b34](https://github.com/QuentinRoy/Marking-Menu/commit/dc86b34))
- Make sure the stroke is cleared upon completion. ([c4cbc9f](https://github.com/QuentinRoy/Marking-Menu/commit/c4cbc9f))

### Features

- Draw stroke. ([89e2b27](https://github.com/QuentinRoy/Marking-Menu/commit/89e2b27))
- Marking Menu's observable must now be subscribed to be effective. ([cd486ad](https://github.com/QuentinRoy/Marking-Menu/commit/cd486ad))

### BREAKING CHANGES

- Marking Menu's observable must now be subscribed to be effective and will be disabled once unsubscribed.

<a name="0.4.0"></a>

# [0.4.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.3.0...v0.4.0) (2017-07-28)

### Features

- Expert / novice navigation mode switching. ([048b439](https://github.com/QuentinRoy/Marking-Menu/commit/048b439))
- Gesture recognizer. ([7cb9f96](https://github.com/QuentinRoy/Marking-Menu/commit/7cb9f96))

<a name="0.3.0"></a>

# [0.3.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.2.0...v0.3.0) (2017-07-22)

### Bug Fixes

- Fix not working movements threshold. ([0235558](https://github.com/QuentinRoy/Marking-Menu/commit/0235558))
- Fix the whole observables chain being subscribed twice. ([6233adc](https://github.com/QuentinRoy/Marking-Menu/commit/6233adc))
- Prevent default drag behavior. ([8a10ae1](https://github.com/QuentinRoy/Marking-Menu/commit/8a10ae1))

### Features

- **menu:** Change menu design. ([c96cc70](https://github.com/QuentinRoy/Marking-Menu/commit/c96cc70))
- Change menu radius. ([5ddeef0](https://github.com/QuentinRoy/Marking-Menu/commit/5ddeef0))

<a name="0.2.0"></a>

# [0.2.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.1...v0.2.0) (2017-07-21)

### Features

- Selection notification now returns the item object. ([f93aa91](https://github.com/QuentinRoy/Marking-Menu/commit/f93aa91))
- **engine:** Introduce a minimum distance from the center to trigger a selection. ([94bea34](https://github.com/QuentinRoy/Marking-Menu/commit/94bea34))
- **model:** Support for children of items. ([2895f30](https://github.com/QuentinRoy/Marking-Menu/commit/2895f30))
- Support for multi-level marking menus. ([3679393](https://github.com/QuentinRoy/Marking-Menu/commit/3679393))

### BREAKING CHANGES

- Selection notifications do not directly gives the name of the selected item anymore but the corresponding model item.

<a name="0.1.1"></a>

## [0.1.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.0...v0.1.1) (2017-07-20)

### Bug Fixes

- Fix missing distributed files. ([d1f50da](https://github.com/QuentinRoy/Marking-Menu/commit/d1f50da))

<a name="0.1.0"></a>

# 0.1.0 (2017-07-20)

### Features

- **menu:** Make the root document configurable. ([5aa198a](https://github.com/QuentinRoy/Marking-Menu/commit/5aa198a))
- **menu:** Set active item by nearest angle. ([e285594](https://github.com/QuentinRoy/Marking-Menu/commit/e285594))
- Selection notifications. ([ff529f2](https://github.com/QuentinRoy/Marking-Menu/commit/ff529f2))
- Engine supporting 1-level Marking Menu. ([39a04f1](https://github.com/QuentinRoy/Marking-Menu/commit/39a04f1))
- Menu Layout. ([02f0b69](https://github.com/QuentinRoy/Marking-Menu/commit/02f0b69))
