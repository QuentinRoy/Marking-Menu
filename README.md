# Marking Menu

[![NPM](https://img.shields.io/npm/v/marking-menu.svg)](https://www.npmjs.com/package/marking-menu)
[![CI](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/ci.yml/badge.svg)](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/ci.yml)
[![Deploy](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/deploy.yml/badge.svg)](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/deploy.yml)

A JavaScript marking menu for mouse, touch, and pen input. Press and pause to show the menu, then move toward an item and release to select it. Once you know the directions, draw the gesture without waiting for the menu.

[Try the demo](https://quentinroy.github.io/Marking-Menu/) or [build your own menu in the playground](https://quentinroy.github.io/Marking-Menu/playground/).

## Install

```sh
npm install marking-menu
```

The package uses ES modules, includes its styles, and ships TypeScript declarations. Create menus in the browser after the parent element exists.

### Browser without a bundler

Add this import map before your module script:

```html
<script type="importmap">
  {
    "imports": {
      "marking-menu": "https://esm.sh/marking-menu@1?raw"
    }
  }
</script>
```

## Browser support

The library requires Chrome and Edge 111, Firefox 115, or Safari and iOS 16.4, or newer. Dark mode colors, which you opt into with `color-scheme`, need Chrome and Edge 123, Firefox 120, or Safari 17.5. Firefox 115 to 118 don't expose the menu's accessibility roles.

## Usage

Give the menu a container with room for gestures:

```html
<div id="menu-area" style="position: relative; height: 400px"></div>
```

Run this in your application, or in a `<script type="module">` after the container:

```js
import { createMarkingMenu } from 'marking-menu';

const menu = createMarkingMenu({
  parent: document.getElementById('menu-area'),
  items: [
    { label: 'Copy' },
    {
      label: 'More',
      items: [{ label: 'Duplicate' }, { label: 'Delete' }],
    },
    { label: 'Paste' },
    { label: 'Undo' },
  ],
});

menu.on('select', (event) => {
  console.log(event.selection.label);
});
```

The menu listens immediately. Here, Copy is up, More is right, Paste is down, and Undo is left. Pause over More to open its submenu.

Call `menu.dispose()` when the container is removed or you no longer need the menu. It stops listening and removes the elements the menu created.

## API

### `createMarkingMenu({ items, parent, ...options })`

Returns an active controller. The required properties are:

- `parent`: The `HTMLElement` that receives pointer input and contains the menu.
- `items`: An array of item objects. Each has a required `label` string and optional `id`, `angle`, and nested `items`. Labels display as plain text. IDs are strings and must be unique across the whole menu. A nonempty `items` array makes an item a submenu.

See [item layout](#item-layout) for angles. TypeScript infers event and item types from your configuration; a selected item's `id` is `undefined` if you did not supply one.

### Options

Pass options alongside `items` and `parent`. Distances use pixels; delays use milliseconds.

| Option                | Default    | Purpose                                                                                  |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `noviceDwellingTime`  | `1000 / 3` | Pause before showing the menu.                                                           |
| `submenuOpeningDelay` | `1000 / 3` | Pause before opening a submenu.                                                          |
| `movementsThreshold`  | `5`        | Movement needed to start a gesture without opening the menu, or restart a submenu pause. |
| `deadZoneRadius`      | `40`       | Distance from the menu center past which an item becomes active and can open a submenu.  |

Use `log: { error: handler }` to handle internal errors; the default is `console.error`. Invalid menu definitions throw during construction.

### Events and cleanup

Use `menu.on(type, listener)` to register a listener and `menu.off(type, listener)` to remove that same listener.

| Event    | When it fires                                                        |
| -------- | -------------------------------------------------------------------- |
| `start`  | A gesture begins.                                                    |
| `open`   | A menu or submenu opens, or `open()` displays one.                   |
| `move`   | The pointer moves during a gesture.                                  |
| `change` | The active item changes while a menu is open.                        |
| `select` | A gesture, or a menu shown with `open()`, ends with a selected item. |
| `cancel` | A gesture, or a menu shown with `open()`, ends without a selection.  |

`select` carries the selected item as `event.selection`, including its `id` and `label`. `cancel` carries `event.reason`: `no-selection` when a gesture ends with nothing to select, `interrupted` when the browser cancels the pointer, or `dismissed` when `close()`, Escape, Tab, or focus leaving the menu closes one shown with `open()`.

Every event includes `mode`: `startup` while waiting for movement or a pause, `novice` while using a visible menu, `expert` while drawing a gesture, or `standalone` for a menu shown with [`open()`](#open-and-close) instead of a gesture, and operated with the keyboard. Every event also includes `position`, a viewport `[x, y]` pair, except in `standalone` mode, where no pointer is involved and it is `undefined`. Checking `mode` narrows `position` in TypeScript:

```js
menu.on('cancel', (event) => {
  if (event.mode !== 'standalone') {
    const [x, y] = event.position;
  }
});
```

`open`, `select`, and `cancel` events also include `recognition` when the recognizer ran on a stroke, and `undefined` otherwise. It holds `stroke`, the points the recognizer was given, and `analysis`, how it cut them: `articulationPoints`, the corners of the stroke, and `segments`, the pieces between corners, each with the two `points` it spans. All points are in viewport pixels. See [the event types](src/events.ts) for each payload.

`dispose()` ends the controller's lifetime and can be called more than once. The controller also supports `using` where your toolchain supports it.

### `open()` and `close()`

`menu.open(options?)` displays the root menu without a gesture, for example from a button or a keyboard shortcut, and lets the [keyboard](#keyboard) operate it. This is a standalone menu. `menu.close()` closes it and fires `cancel`. The menu also closes when focus leaves it. `open()` throws if a gesture or another menu is in progress, and both methods throw after `dispose()`. `close()` throws when no menu is open. Pointer input goes to the page and starts no gesture until the menu closes, by selection, cancellation, or `close()`.

| Option     | Default              | Purpose                                                                                            |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `position` | Center of the parent | Where the menu is centered, in viewport pixels. Read once: the menu does not follow.               |
| `focus`    | `true`               | Whether the menu takes focus. With `false` the menu is only displayed, see [below](#display-only). |

Events from a standalone menu have `mode: 'standalone'`. The menu fires `open` for the root and again each time the keyboard enters or leaves a submenu, `change` as the active item changes, then `select` or `cancel`. It never fires `start` or `move`.

### Display only

`menu.open({ focus: false })` only draws the menu. Focus stays where it is, the first item is reachable with Tab, and closing gives no focus back. Close it with `close()`, with the keyboard once an item has focus, or by moving focus away after entering the menu.

## Item layout

Angles are clockwise degrees from the right: `0` is right, `90` is down, `180` is left, and `270` is up. Each menu level uses its own layout; submenu angles are measured from the right, not from the parent's direction.

Items keep their clockwise array order. Stated angles must be finite and distinct after wrapping into `[0, 360)`. They must fit within one clockwise turn in array order: `270, 0, 90` is valid; `0, 270, 180` is not.

Every gap between neighboring items, including the last and first, must be at least 45 degrees. Construction throws if a gap is smaller, so at most eight items fit in a level.

Items without an `angle` are spaced as follows. Results below follow array order and use degrees:

| Stated angles | Placement                                                                                 | Example                                                               |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| None          | Equal spacing around the circle, starting at the top (`270`).                             | Four items: `270, 0, 90, 180`.                                        |
| One           | Equal spacing, rotated to keep that item at its angle.                                    | Four items, third at `90`: `270, 0, 90, 180`.                         |
| Several       | Equal spacing within each gap between stated angles, including the gap back to the first. | Five items, first at `0` and fourth at `180`: `0, 60, 120, 180, 270`. |

For the last example, paste this into the [playground](https://quentinroy.github.io/Marking-Menu/playground/):

```json
{
  "items": [
    { "label": "First", "angle": 0 },
    { "label": "Second" },
    { "label": "Third" },
    { "label": "Fourth", "angle": 180 },
    { "label": "Fifth" }
  ]
}
```

Second and Third split the first 180-degree gap into three 60-degree steps. Fifth splits the remaining 180-degree gap in half, landing at `270`.

## Appearance

Each controller owns one `<div class="marking-menu">` with an open shadow root. The host remains mounted until you dispose the controller, including during expert gestures that never open a menu. The root is available for inspection, but its elements are not a styling API and direct mutation is unsupported. Use `.marking-menu` as the stable host selector for custom properties.

Scope the host selector to a container when only one menu should change:

```css
#menu-area .marking-menu {
  --mm-plate-fill: hwb(0 13% 87%);
  --mm-plate-text-color: hwb(0 100% 0%);
  --mm-plate-fill-active: hwb(0 27% 73%);
  --mm-plate-text-color-active: hwb(0 100% 0%);
}
```

Lengths accept CSS length values, including `em`, `rem`, and `calc()`. Colors accept any CSS color value. Stroke values apply immediately; layout values are resolved when a menu opens.

Some colors default to a different value in dark mode, picked with [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark). It needs `color-scheme` declared on the host page or an ancestor, typically `color-scheme: light dark` on `:root`.

### Fill and outline colors

Wedges, plates, and outer connectors share one fill color and one inset outline color by default, so a theme usually only needs to set these.

| Property                    | Light              | Dark               | Purpose                               |
| --------------------------- | ------------------ | ------------------ | ------------------------------------- |
| `--mm-fill`                 | `hwb(0 95% 5%)`    | `hwb(0 17% 83%)`   | Resting fill color.                   |
| `--mm-fill-active`          | `hwb(215 85% 3%)`  | `hwb(215 20% 64%)` | Active fill color.                    |
| `--mm-outline-color`        | `hwb(0 50% 50%)`   | `hwb(0 38% 62%)`   | Inset outline color.                  |
| `--mm-outline-color-active` | `hwb(215 10% 30%)` | `hwb(215 52% 18%)` | Active inset outline color.           |
| `--mm-outline-width`        | `1px`              | `1px`              | Inset outline width. `0` disables it. |
| `--mm-outline-width-active` | Outline width      | Outline width      | Active inset outline width.           |

### Muted color

| Property           | Light            | Dark             | Purpose                                          |
| ------------------ | ---------------- | ---------------- | ------------------------------------------------ |
| `--mm-muted-color` | `hwb(0 85% 15%)` | `hwb(0 30% 70%)` | Shared default for less prominent color accents. |

Earlier gesture segments default to this color.

### Plate and label properties

| Property                          | Default                                         | Purpose                                      |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `--mm-plate-fill`                 | Fill color                                      | Plate background.                            |
| `--mm-plate-text-color`           | `hwb(0 0% 100%)`, `hwb(0 88% 12%)` in dark mode | Label color.                                 |
| `--mm-plate-fill-active`          | Active fill color                               | Active plate background.                     |
| `--mm-plate-text-color-active`    | Label color                                     | Active label color.                          |
| `--mm-plate-padding`              | `12px`                                          | Space around the label.                      |
| `--mm-plate-corner-radius`        | `16px`                                          | Plate corner radius.                         |
| `--mm-plate-font-size`            | `20px`                                          | Label font size.                             |
| `--mm-plate-min-width`            | `0`                                             | Minimum plate width.                         |
| `--mm-plate-max-width`            | `none`                                          | Maximum plate width before label truncation. |
| `--mm-plate-outline-color`        | `transparent`                                   | Plate inset outline color.                   |
| `--mm-plate-outline-color-active` | Plate outline color                             | Active plate inset outline color.            |
| `--mm-plate-outline-width`        | Outline width                                   | Plate inset outline width. `0` disables it.  |
| `--mm-plate-outline-width-active` | Plate outline width                             | Active plate inset outline width.            |

Browsers without `text-box-trim` and `text-box-edge` support add `0.2em` to the configured plate padding so text is not clipped vertically.

### Wedge and ring properties

| Property                          | Default              | Purpose                                               |
| --------------------------------- | -------------------- | ----------------------------------------------------- |
| `--mm-wedge-thickness`            | `40px`               | Distance from `deadZoneRadius` to the ring's outside. |
| `--mm-wedge-fill`                 | Fill color           | Wedge fill.                                           |
| `--mm-wedge-fill-active`          | Active fill color    | Active wedge fill.                                    |
| `--mm-wedge-gap`                  | `4px`                | Constant-width gap between wedges.                    |
| `--mm-wedge-corner-radius`        | `4px`                | Wedge corner radius.                                  |
| `--mm-wedge-outline-color`        | Outline color        | Wedge inset outline color.                            |
| `--mm-wedge-outline-color-active` | Active outline color | Active wedge inset outline color.                     |
| `--mm-wedge-outline-width`        | Outline width        | Wedge inset outline width. `0` disables it.           |
| `--mm-wedge-outline-width-active` | Wedge outline width  | Active wedge inset outline width.                     |

### Connector properties

| Property                            | Default           | Purpose                               |
| ----------------------------------- | ----------------- | ------------------------------------- |
| `--mm-connector-thickness`          | `4px`             | Connector thickness.                  |
| `--mm-inner-connector-color`        | `transparent`     | Center-to-ring connector color.       |
| `--mm-outer-connector-color`        | Fill color        | Ring-to-plate connector color.        |
| `--mm-outer-connector-color-active` | Active fill color | Active ring-to-plate connector color. |

### Layout clearance properties

| Property                    | Default | Purpose                                                   |
| --------------------------- | ------- | --------------------------------------------------------- |
| `--mm-plate-gap-horizontal` | `12px`  | Horizontal clearance between plates.                      |
| `--mm-plate-gap-vertical`   | `4px`   | Vertical clearance between plates.                        |
| `--mm-plate-gap-ring`       | `8px`   | Clearance between a plate and the ring.                   |
| `--mm-plate-gap-connector`  | `4px`   | Clearance from a plate to another item's outer connector. |

### Stroke properties

| Property                                 | Light                       | Dark                        | Purpose                                         |
| ---------------------------------------- | --------------------------- | --------------------------- | ----------------------------------------------- |
| `--mm-stroke-color`                      | `hwb(0 0% 100%)`            | `hwb(0 88% 12%)`            | Current gesture color.                          |
| `--mm-stroke-width`                      | `4px`                       | `4px`                       | Current gesture width and indicator start size. |
| `--mm-stroke-start-point-radius`         | `8px`                       | `8px`                       | Novice-mode start marker and indicator radius.  |
| `--mm-stroke-color-earlier`              | Muted color                 | Muted color                 | Earlier gesture segments' color.                |
| `--mm-stroke-width-earlier`              | `--mm-stroke-width`         | `--mm-stroke-width`         | Earlier gesture segments' width.                |
| `--mm-stroke-start-point-radius-earlier` | `--mm-stroke-width-earlier` | `--mm-stroke-width-earlier` | Earlier gesture start marker radius.            |
| `--mm-stroke-color-feedback`             | `--mm-stroke-color`         | `--mm-stroke-color`         | Selected gesture feedback color.                |
| `--mm-stroke-width-feedback`             | `--mm-stroke-width`         | `--mm-stroke-width`         | Completed gesture feedback width.               |
| `--mm-stroke-color-canceled`             | `hwb(11 32% 13%)`           | `hwb(11 45% 5%)`            | Canceled gesture feedback color.                |

Strokes can paint outside the parent without changing its scroll size. Set `overflow: hidden` on the parent when strokes must stay inside its box.

### Opening indicator properties

While dwelling before novice mode opens, whether at the start of a gesture or partway through an expert gesture, and again while dwelling on a submenu, a background circle appears at the pointer with a dot growing inside it. The dot reaches the circle's size right as the menu opens, then becomes its start marker with no visible jump. The cursor stays hidden while it is visible.

| Property                    | Default                                                        | Purpose                  |
| --------------------------- | -------------------------------------------------------------- | ------------------------ |
| `--mm-indicator-fill`       | Stroke color                                                   | Growing dot color.       |
| `--mm-indicator-background` | `hwb(215 20% 30% / 0.2)`, `hwb(215 60% 0% / 0.4)` in dark mode | Background circle color. |

## Input behavior

Gestures start with the primary mouse button, primary touch contact, or primary pen contact. The controller sets the parent's inline `touch-action` to `none !important` for its lifetime, preventing browser touch gestures in that area. It lets go while a menu shown with [`open()`](#open-and-close) is displayed.

Once all controllers sharing the parent are disposed, the previous inline value and priority are restored, unless your application changed the property in the meantime.

## Accessibility

The menu exposes standard menu roles and moves focus so a screen reader speaks the active item. A gesture needs a pointer, so keyboard users get a menu shown with [`open()`](#open-and-close) instead. Your application provides the trigger and announces selections.

A marking menu puts its items in directions around a center, and that is the whole point of it: you learn where an item sits and later flick toward it without looking. The same design is what makes it a poor fit for someone who cannot see the ring, and no key mapping fixes that. Give those users another way to reach the same actions, through a control that never asks where an item sits, and keep the marking menu as the fast path for people who can see it. Which control that is depends on your application and on the assistive technology your users run. The keyboard support below is a second way into this menu, not that alternative.

### Roles and names

The menu container has `role="menu"`, and each item has `role="menuitem"` and takes its accessible name from its label text. Items with a submenu also have `aria-haspopup="menu"`. Wedges, connectors, the stroke, and the opening indicator are hidden from the accessibility tree; they are visual feedback, not content.

The menu container has no accessible name yet. It cannot take one from an element on your page, because ID references such as `aria-labelledby` cannot cross its shadow root.

The arrow keys are the one place the menu leaves the [WAI-ARIA menu pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/), which defines them for menus laid out as vertical lists. This one is a ring, so the arrows follow the ring instead; see [Keyboard](#keyboard). Everything else about the pattern holds, including the roles above and `Enter`, `Escape`, `Tab`, `Home`, and `End`.

### Gestures

When the menu is visible (novice mode), focus moves to the menu container as it opens, then to each item as it becomes active, so a screen reader speaks the item's label. When the gesture ends, by selection or cancellation, focus returns to the element that had it before the menu opened. Expert-mode gestures move too fast for this to help and never move focus.

Screen reader touch passthrough (VoiceOver's hold, TalkBack's double-tap-and-hold-then-drag) sends touches to the page instead of interpreting them. This works for someone who already knows the item layout, but it does not help them discover the items, and whether the active item is announced mid-gesture is untested. Treat it as a bonus for experienced users. To reach every action without a gesture, see [Keyboard](#keyboard).

### Keyboard

A menu shown with [`open()`](#open-and-close) works with the keyboard. When it opens, focus moves to the first item. The focused item is the active one, so a screen reader speaks each label as you move. When the menu closes, focus returns to the element that had it before, unless focus moved elsewhere to close it. Pass `focus: false` to show the menu without moving focus; see [Display only](#display-only).

| Key                                               | Action                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` | Move focus that way around the ring.                              |
| `Home`, `End`                                     | Focus the first or last item.                                     |
| `Enter`                                           | Select a leaf, or open a submenu.                                 |
| `Escape`                                          | Go back to the parent menu, or close the menu from the root.      |
| `Tab`                                             | Close the menu from any level and move focus to the next element. |

The menu ignores keys pressed with `Ctrl`, `Alt`, or `Meta`, so page and browser shortcuts keep working.

An arrow moves focus relative to the item that already has it, to the item the smallest turn away among those lying further in that direction. Hold a direction and focus stops at the edge of the ring rather than wrapping. With nothing focused yet, the first arrow jumps to the item nearest that direction.

So no single arrow walks a whole level, and reaching every item means changing direction. Crossing a four item ring takes two presses: from the right item, `ArrowLeft` steps to the bottom item first.

Nothing opens the menu from the keyboard until you call [`open()`](#open-and-close), for example from a button or a hotkey. A hotkey listener keeps firing while the menu is open, so have it skip keys that come from inside the menu.

### Announcing selections

The `select` event does not announce anything by itself, so announce the selection yourself, for example with a live region:

```js
const status = document.querySelector('[aria-live="polite"]');
menu.on('select', (event) => {
  status.textContent = event.selection.label;
});
```

### Motion, colors, and contrast

- When the user prefers reduced motion (`prefers-reduced-motion`), the opening indicator fades in instead of growing.
- In forced colors mode (`forced-colors`), wedges, plates, connectors, the stroke, and the opening indicator use system colors.
- Wedges and plates have an inset outline by default that helps them stand out against your page. [Fill and outline colors](#fill-and-outline-colors) lists the properties that change it.

## Upgrading from 0.10.1

Default item positions change in every menu level where no item states an `angle`: it now starts from the top (`270`) instead of the right (`0`), rotating 90 degrees counterclockwise. Levels with at least one stated angle are unaffected. In 2-, 3-, 5-, 6-, and 7-item levels with no stated angles, this compounds with an earlier layout change. The rotation causes no error or build failure, but learned gestures can select different items. Set each item's `angle` to preserve its previous direction.

The release also changes imports, menu configuration, and event handling. Use the named `createMarkingMenu` export with a configuration object and register listeners with `on`. Replace subscription cleanup with `dispose()`.

### Appearance and theming

The menu and stroke surfaces now share one open shadow root for the controller's lifetime. Page CSS cannot reach the internal class names. `.marking-menu` is now the host, present in the parent for the controller's lifetime, and these selectors stop working:

| Old selector or state                                                              | Replacement                                                                      |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.marking-menu-item`                                                               | None. Item structure is internal.                                                |
| `.marking-menu-label`                                                              | Use the `--mm-plate-*` properties; inherited font properties can go on the host. |
| `.marking-menu-line`                                                               | Use the `--mm-connector-*` properties.                                           |
| `.marking-menu-item.active ...`                                                    | Use the corresponding `--mm-*-active` property.                                  |
| `.bottom-right-item`, `.bottom-left-item`, `.top-left-item`, and `.top-right-item` | `--mm-plate-corner-radius` applies to every plate corner.                        |

Replace the old custom properties as follows:

| Old property               | Replacement                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `--item-width`             | `--mm-plate-min-width` and `--mm-plate-max-width`.              |
| `--item-height`            | None. Plate height follows the label and padding.               |
| `--item-font-size`         | `--mm-plate-font-size`.                                         |
| `--item-padding`           | `--mm-plate-padding`.                                           |
| `--item-background`        | `--mm-plate-fill`.                                              |
| `--item-color`             | `--mm-plate-text-color`.                                        |
| `--active-item-background` | `--mm-plate-fill-active`.                                       |
| `--active-item-color`      | `--mm-plate-text-color-active`.                                 |
| `--item-radius`            | `--mm-plate-corner-radius`.                                     |
| `--menu-radius`            | `--mm-wedge-thickness`, measured outward from `deadZoneRadius`. |
| `--center-radius`          | None. It was unused.                                            |
| `--line-thickness`         | `--mm-connector-thickness`.                                     |
| `--line-color`             | `--mm-outer-connector-color`.                                   |
| `--active-line-color`      | `--mm-outer-connector-color-active`.                            |

Label plates now hug their text. Set both width properties to restore the old fixed width and ellipsis:

```css
.marking-menu {
  --mm-plate-min-width: 120px;
  --mm-plate-max-width: 120px;
}
```

The visible connector now starts at the ring. Set the inner connector to the same color for a continuous center-to-plate line:

```css
.marking-menu {
  --mm-inner-connector-color: var(
    --mm-outer-connector-color,
    var(--mm-outline-color, var(--mm-fill))
  );
}
```

Nine stroke options moved from `createMarkingMenu` configuration to CSS:

| Removed option                       | Replacement                               |
| ------------------------------------ | ----------------------------------------- |
| `strokeColor`                        | `--mm-stroke-color`.                      |
| `strokeWidth`                        | `--mm-stroke-width`.                      |
| `strokeStartPointRadius`             | `--mm-stroke-start-point-radius`.         |
| `lowerStrokeColor`                   | `--mm-stroke-color-earlier`.              |
| `lowerStrokeWidth`                   | `--mm-stroke-width-earlier`.              |
| `lowerStrokeStartPointRadius`        | `--mm-stroke-start-point-radius-earlier`. |
| `gestureFeedbackStrokeWidth`         | `--mm-stroke-width-feedback`.             |
| `gestureFeedbackStrokeColor`         | `--mm-stroke-color-feedback`.             |
| `gestureFeedbackCanceledStrokeColor` | `--mm-stroke-color-canceled`.             |

`gestureFeedbackDuration` remains a configuration option and still defaults to `1000` milliseconds.

## Development

Visual baselines are committed for the pinned container only (`-chromium-linux.png`). Outside it, `yarn test:browser` has nothing to compare against and just writes a fresh platform-local baseline (e.g. `-chromium-darwin.png`, gitignored) on first run. Generate that baseline before making a rendering change, so running the same command afterward gives a diff instead of an automatic pass. Inside the container this isn't needed: the checked-in `-chromium-linux.png` files are already the reference to test against.

If a PR changes rendered output, CI fails and comments with the list of mismatched snapshots. Adding the `update screenshots` label to the PR regenerates and commits them automatically (same-repo PRs only; forks and Dependabot need a maintainer to do it from a trusted branch).

## Background and license

This library implements Gordon Kurtenbach's marking menus: [paper 1](https://doi.org/10.1145/120782.120797), [paper 2](http://doi.acm.org/10.1145/169059.169426), and [paper 3](http://doi.acm.org/10.1145/191666.191759).

This codebase is licensed under the MIT license.

Several patents concern marking menus; none belong to this library's author. Make sure you have the rights to use the library in your application. The authors and contributors may not be held responsible for patent infringement resulting from its use.
