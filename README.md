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

The menu listens immediately. Here, Copy is right, More is down, Paste is left, and Undo is up. Pause over More to open its submenu.

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

| Event    | When it fires                                 |
| -------- | --------------------------------------------- |
| `start`  | A gesture begins.                             |
| `open`   | A menu or submenu opens.                      |
| `move`   | The pointer moves during a gesture.           |
| `change` | The active item changes while a menu is open. |
| `select` | A gesture ends with a selected item.          |
| `cancel` | A gesture ends without a selection.           |

`select` carries the selected item as `event.selection`, including its `id` and `label`.

Every event includes `position`, a viewport `[x, y]` pair, and `mode`: `startup` while waiting for movement or a pause, `novice` while using a visible menu, or `expert` while drawing a gesture. See [the event types](src/events.ts) for each payload.

`dispose()` ends the controller's lifetime and can be called more than once. The controller also supports `using` where your toolchain supports it.

## Item layout

Angles are clockwise degrees from the right: `0` is right, `90` is down, `180` is left, and `270` is up. Each menu level uses its own layout; submenu angles are measured from the right, not from the parent's direction.

Items keep their clockwise array order. Stated angles must be finite and distinct after wrapping into `[0, 360)`. They must fit within one clockwise turn in array order: `270, 0, 90` is valid; `0, 270, 180` is not.

Every gap between neighboring items, including the last and first, must be at least 45 degrees. Construction throws if a gap is smaller, so at most eight items fit in a level.

Items without an `angle` are spaced as follows. Results below follow array order and use degrees:

| Stated angles | Placement                                                                                 | Example                                                               |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| None          | Equal spacing around the circle, starting at `0`.                                         | Four items: `0, 90, 180, 270`.                                        |
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

Set CSS variables on `.marking-menu` to style labels and layout. Scope the selector to your container to style one menu:

```css
#menu-area .marking-menu {
  --mm-plate-background: #222;
  --mm-plate-color: #fff;
  --mm-plate-background-active: #444;
  --mm-plate-color-active: #fff;
}
```

See [the menu styles](src/layout/menu.css) for size, spacing, and line variables.

Gesture strokes use configuration options: `strokeColor` defaults to `'#000'`, `strokeWidth` to `4`, and `strokeStartPointRadius` to `8`. Widths and radii use pixels. [The drawing options](src/engine/renderer.ts) also cover earlier stroke segments and completed-gesture feedback.

## Input behavior

Gestures start with the primary mouse button, primary touch contact, or primary pen contact. The controller sets the parent's inline `touch-action` to `none !important` for its lifetime, preventing browser touch gestures in that area.

Once all controllers sharing the parent are disposed, the previous inline value and priority are restored, unless your application changed the property in the meantime.

## Upgrading from 0.10.1

Default item positions change in 5-, 6-, and 7-item menus. The layout change causes no error or build failure, but learned gestures can select different items. Set each item's `angle` to preserve its previous direction.

The release also changes imports, menu configuration, and event handling. Use the named `createMarkingMenu` export with a configuration object and register listeners with `on`. Replace subscription cleanup with `dispose()`.

## Background and license

This library implements Gordon Kurtenbach's marking menus: [paper 1](https://doi.org/10.1145/120782.120797), [paper 2](http://doi.acm.org/10.1145/169059.169426), and [paper 3](http://doi.acm.org/10.1145/191666.191759).

This codebase is licensed under the MIT license.

Several patents concern marking menus; none belong to this library's author. Make sure you have the rights to use the library in your application. The authors and contributors may not be held responsible for patent infringement resulting from its use.
