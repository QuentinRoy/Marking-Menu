# Changelog

## 1.0.1

### Patch Changes

- [#503](https://github.com/QuentinRoy/Marking-Menu/pull/503) [`7e15047`](https://github.com/QuentinRoy/Marking-Menu/commit/7e1504707c992bce27d81a4e702939f51df05e27) - Fix the published package to include the built JavaScript and TypeScript declarations.

## 1.0.0

### Major Changes

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Stop generating IDs for items without one: their `id` is now `undefined` instead of a positional ID like `'1-0'`. Give an item an `id` if you look it up by ID. The positional ID moves to the new `key` property.

- [#311](https://github.com/QuentinRoy/Marking-Menu/pull/311) [`999feaf`](https://github.com/QuentinRoy/Marking-Menu/commit/999feaf2021ab5a06d7fe42304d69fa979a028b8) - Size label plates to their text instead of a fixed 120 px width. Set `--mm-plate-min-width` and `--mm-plate-max-width` to `120px` to keep the fixed, truncated width. Plates also default to more padding and rounder corners, with no square corner toward the center.

- [#273](https://github.com/QuentinRoy/Marking-Menu/pull/273) [`2381311`](https://github.com/QuentinRoy/Marking-Menu/commit/23813114708c542c4e69361d0948b0ad5c464f52) - `createMarkingMenu` throws when items in a level are less than 45° apart, such as a level with more than 8 items, because directions that close together can't be told apart. Move extra items into submenus, or space stated angles at least 45° apart.

- [#233](https://github.com/QuentinRoy/Marking-Menu/pull/233) [`ab83b8b`](https://github.com/QuentinRoy/Marking-Menu/commit/ab83b8bede215758236a79640d956dfa8b80470e) - `createMarkingMenu` returns a controller instead of an RxJS `Observable`, so you no longer install `rxjs`. The menu is active as soon as you create it. Listen with `on(type, listener)`, and stop the menu with `dispose()` or `using`.

  ```js
  // 0.10.1
  const subscription = MarkingMenu(items, parent).subscribe((selection) => {
    console.log(selection.name);
  });
  subscription.unsubscribe();

  // 1.0
  const menu = createMarkingMenu({ items, parent });
  menu.on('select', (event) => console.log(event.selection.label));
  menu.dispose();
  ```

  The controller emits `start`, `open`, `move`, `change`, `select`, and `cancel` events, exported as classes such as `MarkingMenuSelectEvent`. Their fields are getters, so spreading an event or `JSON.stringify()` doesn't copy them. They replace the `notifySteps` option, with these differences: `draw` becomes `move`, `move` also fires alongside `change`, `cancel` has no `selection`, `active` is now `activeItem` and only on `move`, `change`, and `cancel`, and no event has `timeStamp`.

  `menu.state` reports what the menu is doing between events: `mode` is `idle`, `startup`, `expert`, `novice`, or `standalone`, and `novice` and `standalone` also carry the displayed `menu` and the `activeItem`. Inside a listener it already reflects the event being dispatched. The package exports the new `MarkingMenuState` type.

  `menu.open()` displays the menu without a gesture. Mouse, touch, pen, and keyboard all operate it, and `menu.close()` closes it. Pass `{ position }`, in viewport pixels, to center it somewhere other than the parent's center. Events from such a menu have `mode: 'standalone'`, and, like novice mode, fire `move` on pointer movement. Every event has a `source`: `'pointer'`, `'keyboard'`, `'gesture'` (drawing a mark), `'api'` (an `open()` or `close()` call, or the focus `open()` gives the first item), or `'focus-loss'` (the menu lost focus). `position` is a viewport point when `source` is `'pointer'`, and `undefined` otherwise. Check `source`, not `mode`, to know which. When a stroke was recognized, `open`, `select`, and `cancel` events have a `recognition` with the stroke and how it was cut into corners and segments. `cancel` events have a `reason`: `no-selection`, `interrupted` when the browser cancels the pointer, or `dismissed` when a menu shown with `open()` is closed. The package exports the new `MarkingMenuCancelReason`, `MarkingMenuEventSource`, `MarkingMenuOpenOptions`, `MarkingMenuRecognition`, `MarkingMenuStrokeAnalysis`, and `MarkingMenuStrokeSegment` types.

- [#144](https://github.com/QuentinRoy/Marking-Menu/pull/144) [`1580c6e`](https://github.com/QuentinRoy/Marking-Menu/commit/1580c6e1b4e4a5e5d877d7047e4262c011684229) - Ship only an ES module. The UMD build is gone, with its CommonJS, AMD, and `window.MarkingMenu` global loading. Every supported browser loads ES modules natively: use `import` or `<script type="module">`.

- [#260](https://github.com/QuentinRoy/Marking-Menu/pull/260) [`195d2dd`](https://github.com/QuentinRoy/Marking-Menu/commit/195d2ddbbb670ef365b26ef6b14dffe59fa76ed7) - Spread items evenly around the circle for every item count. Menus with 2, 3, 5, 6, or 7 items change: 3 items sit 120° apart instead of 90°. A learned gesture can now select a different item, without any error. Set each item's `angle` to keep its old direction.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the `isLeaf()` and `isRoot()` item methods with `isLeaf` and `isRoot` properties.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Items expose their fields through getters instead of own properties, so spreading an item, `Object.keys()`, or `structuredClone()` no longer copies them. Read the fields you need explicitly.

- [#126](https://github.com/QuentinRoy/Marking-Menu/pull/126) [`5a46547`](https://github.com/QuentinRoy/Marking-Menu/commit/5a46547dadd7fc3855b858dcb74fed359a5fc0a1) - Rename the item `name` property to `label`, and `getChildrenByName()` to `getChildrenByLabel()`.

- [#277](https://github.com/QuentinRoy/Marking-Menu/pull/277) [`ca594cd`](https://github.com/QuentinRoy/Marking-Menu/commit/ca594cd63f7d876da3515640d11d3aaa8c88bd50) - Raise the default `submenuOpeningDelay` from 100 ms to `1000 / 3` ms, the same as `noviceDwellingTime`, so opening a submenu takes the same pause as opening the menu. Set `submenuOpeningDelay: 100` to keep the old delay.

- [#118](https://github.com/QuentinRoy/Marking-Menu/pull/118) [`80d15d6`](https://github.com/QuentinRoy/Marking-Menu/commit/80d15d62ff5192a8af2d0db562f8fcd6591b4686) - Require Chrome and Edge 111, Firefox 115, or Safari and iOS 16.4, or newer. Dark mode colors, which you opt into with `color-scheme`, need Chrome and Edge 123, Firefox 120, or Safari 17.5. Firefox 115 to 118 don't expose the menu's accessibility roles.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Replace the default export with the named `createMarkingMenu` export: `import { createMarkingMenu } from 'marking-menu'`.

- [#262](https://github.com/QuentinRoy/Marking-Menu/pull/262) [`3d2d200`](https://github.com/QuentinRoy/Marking-Menu/commit/3d2d200ca84400b62108d17a1ca75b27ce527f74) - Render labels as plain text instead of HTML, so a label can't inject markup into the page. A label containing HTML now shows the tags as text. Labels are text only.

- [#126](https://github.com/QuentinRoy/Marking-Menu/pull/126) [`5a46547`](https://github.com/QuentinRoy/Marking-Menu/commit/5a46547dadd7fc3855b858dcb74fed359a5fc0a1) - Remove the string shorthand for menu items, so every item has the same shape. Write `{ label: 'Copy' }` instead of `'Copy'`.

- [#126](https://github.com/QuentinRoy/Marking-Menu/pull/126) [`5a46547`](https://github.com/QuentinRoy/Marking-Menu/commit/5a46547dadd7fc3855b858dcb74fed359a5fc0a1) - Pass a single configuration object instead of positional arguments: `createMarkingMenu({ items, parent, ...options })` instead of `MarkingMenu(items, parent, options)`.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - The root has no `id`, `label`, or `angle` instead of having them set to `null`.

- [#302](https://github.com/QuentinRoy/Marking-Menu/pull/302) [`6ca5e42`](https://github.com/QuentinRoy/Marking-Menu/commit/6ca5e42d1dac54243bf6449a68a6a84d0278301f) - Render the menu in an open shadow root on the `.marking-menu` element, so page styles, such as a `box-sizing: border-box` reset, can't break its layout. Page CSS can no longer reach the menu's inner elements, and the theme properties are renamed to `--mm-*`, set on `.marking-menu`. Check the documentation for the replacements.

- [#277](https://github.com/QuentinRoy/Marking-Menu/pull/277) [`ca594cd`](https://github.com/QuentinRoy/Marking-Menu/commit/ca594cd63f7d876da3515640d11d3aaa8c88bd50) - Replace `minSelectionDist` (default 40) and `minMenuSelectionDist` (default 80) with one `deadZoneRadius` option (default 40). An item becomes active past this radius, and pausing on it opens its submenu. Before, a submenu only opened past `minMenuSelectionDist`. Rename `minSelectionDist` to `deadZoneRadius` and remove `minMenuSelectionDist`; JavaScript silently ignores the old names.

- [#383](https://github.com/QuentinRoy/Marking-Menu/pull/383) [`1c836d8`](https://github.com/QuentinRoy/Marking-Menu/commit/1c836d800c45a8b5d5873cf608020a8bb6e2377c) - In novice mode, move focus to the menu and then to the active item, so screen readers announce it. Focus returns where it was when the gesture ends. The focused element gets `blur` and `focusout` events during the gesture.

  A menu shown with `menu.open()` takes focus the same way. Each arrow key moves focus that way around the ring rather than along the item order, so the key you press matches the direction you see. Home and End jump to the ends of the item order, Enter selects a leaf or opens a submenu, Escape goes back up a level or closes the menu from the root, and Tab closes it from any level. It also closes when focus moves elsewhere, leaving focus there. Pass `{ autoFocus: false }` to open it without moving focus; it closes on focus loss only after focus enters it. Entering a submenu always leaves focus in the menu. `open` events carry `willAutoFocus`, `false` only for a menu opened this way.

- [#474](https://github.com/QuentinRoy/Marking-Menu/pull/474) [`6db62d0`](https://github.com/QuentinRoy/Marking-Menu/commit/6db62d07cc9f3d9c50314defe788613bc67ef99d) - A menu shown with `menu.open()` now also answers the mouse, touch, and pen, alongside the keyboard, and shows a pointer cursor over its items. Hovering an item makes it active without moving focus, and moving off the menu clears it. Clicking a leaf selects it and clicking a submenu item opens it, both giving focus to the new level. Clicking outside the menu, or releasing a drag there, dismisses it.

- [#319](https://github.com/QuentinRoy/Marking-Menu/pull/319) [`f90a2db`](https://github.com/QuentinRoy/Marking-Menu/commit/f90a2dbe103e118a098dc28757089afbc00cc9e5) - Replace the nine stroke options, such as `strokeColor` and `lowerStrokeWidth`, with `--mm-stroke-*` custom properties, so you style strokes in CSS like the rest of the menu. Check the documentation for the replacements.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Rename `children` to `items`, on the items you pass and on the items the menu returns, to match the top-level `items` option. Items without sub-items return `items: []` instead of `undefined`.

- [#124](https://github.com/QuentinRoy/Marking-Menu/pull/124) [`de5942f`](https://github.com/QuentinRoy/Marking-Menu/commit/de5942ff51e660f8a1c546d310135e4a19e57d89) - Rename the `subMenuOpeningDelay` option to `submenuOpeningDelay`.

- [#334](https://github.com/QuentinRoy/Marking-Menu/pull/334) [`3413aa3`](https://github.com/QuentinRoy/Marking-Menu/commit/3413aa3c830e2db82770402d91ba1384363e2bca) - Strokes are no longer clipped to the parent, like the menu itself. Set `overflow: hidden` on the parent to keep both inside it. The `.marking-menu` element now stays in the parent until you dispose the menu, so its presence no longer means a menu is open.

- [#150](https://github.com/QuentinRoy/Marking-Menu/pull/150) [`c7ad8ad`](https://github.com/QuentinRoy/Marking-Menu/commit/c7ad8adf834abe13cf3f1d76504b499e4ea3a186) - Handle input with Pointer Events. Only the primary mouse button, touch, or pen starts a gesture, so right and middle clicks no longer open the menu, and a second touch no longer ends it. A gesture keeps tracking when the pointer leaves the parent, and always cancels when the browser cancels the pointer. The parent gets `touch-action: none` until you dispose the menu, except while a menu shown with `menu.open()` is displayed. Then pointer input goes to the page and no gesture starts.

- [#455](https://github.com/QuentinRoy/Marking-Menu/pull/455) [`6bae798`](https://github.com/QuentinRoy/Marking-Menu/commit/6bae798e71e106989dc91a83a0be72ac3b43d701) - Default item positions now start at the top instead of the right: a menu level where no item states an `angle` spreads its items 90 degrees counterclockwise from the previous default. Levels with at least one stated angle are unaffected. A learned gesture can now select a different item, without any error. Set each item's `angle` to keep its old direction.

- [#410](https://github.com/QuentinRoy/Marking-Menu/pull/410) [`b862390`](https://github.com/QuentinRoy/Marking-Menu/commit/b8623908c3fe36c9ef670157197cd38054ed0b97) - Type `MarkingMenuLogger`'s `info`, `warn`, and `debug` as `(message: string) => void` instead of `unknown`, so the library can start calling them without a later breaking change. Make `error` optional too, matching every other method.

- [#138](https://github.com/QuentinRoy/Marking-Menu/pull/138) [`c150389`](https://github.com/QuentinRoy/Marking-Menu/commit/c150389e9a1cc5254d9a42bfeb0c81290474d86e) - Require item IDs to be unique across the whole menu. `createMarkingMenu` throws on duplicates, and TypeScript rejects duplicate literal IDs.

### Minor Changes

- [#474](https://github.com/QuentinRoy/Marking-Menu/pull/474) [`6db62d0`](https://github.com/QuentinRoy/Marking-Menu/commit/6db62d07cc9f3d9c50314defe788613bc67ef99d) - Add `--mm-inner-connector-thickness` (default `0`) and `--mm-outer-connector-thickness` (default `4px`) to size each connector on its own, and `--mm-connector-color`/`--mm-connector-color-active`, a shared fallback color for both connectors.

- [#261](https://github.com/QuentinRoy/Marking-Menu/pull/261) [`b93d497`](https://github.com/QuentinRoy/Marking-Menu/commit/b93d497f6e7ba9bbd5d97941e0c836395dfa6f68) - Let items set an optional `angle`, in degrees clockwise from the right. Items without one fill the gaps between stated angles.

- [#290](https://github.com/QuentinRoy/Marking-Menu/pull/290) [`1b2b563`](https://github.com/QuentinRoy/Marking-Menu/commit/1b2b563de130a3e4290fa4159c81f133b5bc850e) - Place labels so they don't overlap, instead of at one fixed distance from the center. Tune the spacing with the `--mm-plate-gap-*` properties.

- [#370](https://github.com/QuentinRoy/Marking-Menu/pull/370) [`aa25858`](https://github.com/QuentinRoy/Marking-Menu/commit/aa25858d399ab7befca64ac6ca49f7ff81e8e39e) - Expose the menu to assistive technologies with the `menu` and `menuitem` roles. Items take their label as their name, and items with a submenu have `aria-haspopup="menu"`.

- [#386](https://github.com/QuentinRoy/Marking-Menu/pull/386) [`06f9ae4`](https://github.com/QuentinRoy/Marking-Menu/commit/06f9ae4c372182984ddb86f2b4fcba71d7e2e0f1) - Add `--mm-muted-color`, the default color of earlier gesture segments. Earlier segments are lighter than 0.10.1's `[#777](https://github.com/QuentinRoy/Marking-Menu/issues/777)`.

- [#345](https://github.com/QuentinRoy/Marking-Menu/pull/345) [`55d8361`](https://github.com/QuentinRoy/Marking-Menu/commit/55d83611a26bdbacebd13b97a264fd70c5e14841) - Show a dot growing inside a circle during the pause before a menu or submenu opens. It fades in instead when the user prefers reduced motion. Style it with `--mm-indicator-fill` and `--mm-indicator-background`.

- [#382](https://github.com/QuentinRoy/Marking-Menu/pull/382) [`fc6b7c5`](https://github.com/QuentinRoy/Marking-Menu/commit/fc6b7c5003e2528dcacc5fdd64a413a587105838) - Draw a 1px gray inset outline on wedges, blue on the active one. Change it with `--mm-outline-width` and `--mm-outline-color`, their `-active` variants, and per-part variants, which can also outline plates.

- [#384](https://github.com/QuentinRoy/Marking-Menu/pull/384) [`76e13b1`](https://github.com/QuentinRoy/Marking-Menu/commit/76e13b1eadccf0f5ac1ef6256db2679fcffed897) - Use system colors in forced colors mode.

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Ship TypeScript declarations. Items in events are typed from the items you pass, so their `id` and `label` narrow to the values you wrote.

- [#382](https://github.com/QuentinRoy/Marking-Menu/pull/382) [`fc6b7c5`](https://github.com/QuentinRoy/Marking-Menu/commit/fc6b7c5003e2528dcacc5fdd64a413a587105838) - Change the default colors: wedges and plates have a pale fill with black labels, and the active item turns blue. Set `--mm-fill` and `--mm-fill-active` to recolor wedges, plates, and connectors together. Colors follow dark mode when the page declares `color-scheme: light dark`.

- [#304](https://github.com/QuentinRoy/Marking-Menu/pull/304) [`f8594c1`](https://github.com/QuentinRoy/Marking-Menu/commit/f8594c15bee8e3f9a5cacd8bf51f55fcba0b9a0b) - Draw a ring of wedges around the menu center, one per item. Style it with the `--mm-wedge-*` properties. Connectors now start at the ring; set `--mm-inner-connector-color` and `--mm-inner-connector-thickness` to draw them from the center.

### Patch Changes

- [#147](https://github.com/QuentinRoy/Marking-Menu/pull/147) [`9c46198`](https://github.com/QuentinRoy/Marking-Menu/commit/9c46198a9730f314c70828f756508320babb7367) - Drop the `raf-schd` dependency.

- [#188](https://github.com/QuentinRoy/Marking-Menu/pull/188) [`fe933d7`](https://github.com/QuentinRoy/Marking-Menu/commit/fe933d7845cb268dddf1ea29ecccf4c7e0f223f7) - A `log` option without an `error` method falls back to `console.error`, and `error` always receives an `Error`.

- [#233](https://github.com/QuentinRoy/Marking-Menu/pull/233) [`ab83b8b`](https://github.com/QuentinRoy/Marking-Menu/commit/ab83b8bede215758236a79640d956dfa8b80470e) - After a gesture switches from expert to novice mode, events report `mode: 'novice'` instead of `undefined`.

- [#344](https://github.com/QuentinRoy/Marking-Menu/pull/344) [`7e7b3fb`](https://github.com/QuentinRoy/Marking-Menu/commit/7e7b3fb0adb9011dcae285705b5c971b567c2307) - Support a `parent` owned by another document, such as an iframe's.

- [#193](https://github.com/QuentinRoy/Marking-Menu/pull/193) [`a872408`](https://github.com/QuentinRoy/Marking-Menu/commit/a87240825aa8999253dda6c7e6157affbcc215a6) - Hide the cursor during gestures instead of showing a crosshair, and restore the parent's own inline `cursor` afterward instead of clearing it.

- [#253](https://github.com/QuentinRoy/Marking-Menu/pull/253) [`7d6704b`](https://github.com/QuentinRoy/Marking-Menu/commit/7d6704be67fd79cf13b379a91e77be158b9cc4c6) - Fix strokes drawn away from the pointer when the parent is not at the top-left corner of the viewport.

- [#409](https://github.com/QuentinRoy/Marking-Menu/pull/409) [`b7cbb41`](https://github.com/QuentinRoy/Marking-Menu/commit/b7cbb4139953cb3d7fa008d3df34c8ab19bf222e) - Fix the submenu-opening dwell never rearming once it fires on a leaf item, so a submenu right next to that leaf could no longer open by dwelling.

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
