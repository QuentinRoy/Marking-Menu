# Marking Menu

[![NPM](https://img.shields.io/npm/v/marking-menu.svg)](https://www.npmjs.com/package/marking-menu)
[![CI](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/ci.yml/badge.svg)](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/ci.yml)
[![Deploy](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/deploy.yml/badge.svg)](https://github.com/QuentinRoy/Marking-Menu/actions/workflows/deploy.yml)

This library is an implementation of Gordon Kurtenbach's infamous Marking Menus in JavaScript [[1](https://doi.org/10.1145/120782.120797), [2](http://doi.acm.org/10.1145/169059.169426), [3](http://doi.acm.org/10.1145/191666.191759)].

[Have a look at the **demo**](https://quentinroy.github.io/Marking-Menu/).

## License

This _codebase_ is licensed under the MIT license.
**However**, Marking Menus are concerned by several patents, none of which are owned by the author of this library.
Make sure you have the rights to include this library in your application before doing so.
The authors and contributors of this library may not be held responsible for any patent infringement following the use of this codebase.

## Install

### Browser with CDN

Use a native ES module with an import map to resolve `marking-menu`:

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "marking-menu": "https://esm.sh/marking-menu@1?raw"
        }
      }
    </script>
    <script type="module">
      import { createMarkingMenu } from 'marking-menu';

      // Your stuff.
    </script>
  </head>
  <body></body>
</html>
```

### ES modules

```sh
npm install -S marking-menu
```

Then:

```js
import { createMarkingMenu } from 'marking-menu';
```

## API

### `createMarkingMenu({ items, parent, ...options })`

`createMarkingMenu` builds the menu and returns an already-active controller. It starts listening for pointer input immediately: there's no separate step to turn it on.

Activation uses the primary button of a mouse, the primary touch contact, or a
primary pen contact. While the menu is active, it temporarily sets the
parent's inline `touch-action` to `none !important` so pointer gestures remain
reliable. The previous inline value and priority are restored once every
controller sharing that parent has been disposed, unless the application
changed the property in the meantime.

- `items`: `Array` of `{ label, angle?, items? }`. The list of the menu's items. If `items` is provided, the item is a submenu. Items remain in listed clockwise order. Each level needs at least 45 degrees between neighboring items.

- `angle`: Optional clockwise angle in degrees from the right.

- `parent`: `HTMLElement`. The container of the menu.

#### Item angles

`0` degrees points right, `90` points down, `180` points left, and `270` points up. When two or more items state an angle, their values must follow the item's clockwise list order. The sequence can wrap once through `0`, such as `270`, `0`, `90`.

Items without an `angle` keep their place in the list and divide the gap between the stated angles around them. [Build a menu in the playground](https://quentinroy.github.io/Marking-Menu/playground/) to try a layout.

With no stated angles, items spread evenly around the circle, starting at the right:

```js
[
  { label: 'First' },
  { label: 'Second' },
  { label: 'Third' },
  { label: 'Fourth' },
];
```

The items land at `0`, `90`, `180`, and `270` degrees.

With one stated angle, the same even layout rotates around that item:

```js
[
  { label: 'First' },
  { label: 'Second' },
  { angle: 90, label: 'Third' },
  { label: 'Fourth' },
];
```

The items land at `270`, `0`, `90`, and `180` degrees.

With several stated angles, free items divide each gap independently:

```js
[
  { angle: 0, label: 'First' },
  { label: 'Second' },
  { label: 'Third' },
  { angle: 180, label: 'Fourth' },
  { label: 'Fifth' },
];
```

The items land at `0`, `60`, `120`, `180`, and `270` degrees.

The controller dispatches six events during a gesture: `start`, `open`, `move`, `change`, `select`, and `cancel`. Listen with `controller.on(type, listener)`, matching `off` to remove a listener. When you're done with the menu, call `controller.dispose()` (or use it with `using`, where your toolchain supports Explicit Resource Management) to stop listening for pointer input and release the DOM resources it created.

#### Example

```js
// Create the menu with a sub-menu at the bottom.
const items = [
  { label: 'Item Right' },
  {
    label: 'Others...',
    items: [
      { label: 'Sub Right' },
      { label: 'Sub Down' },
      { label: 'Sub Left' },
      { label: 'Sub Top' },
    ],
  },
  { label: 'Item Left' },
  { label: 'Item Up' },
];
const menu = createMarkingMenu({
  items,
  parent: document.getElementById('main'),
});

menu.on('select', (event) => {
  // Do something.
  console.log(event.selection.label);
});

setTimeout(() => {
  // Later, disable the menu.
  menu.dispose();
}, 60 * 1000);
```
