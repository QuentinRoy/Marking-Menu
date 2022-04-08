# Marking Menu

[![NPM](https://img.shields.io/npm/v/marking-menu.svg)](https://www.npmjs.com/package/marking-menu)
[![Build Status](https://travis-ci.org/QuentinRoy/Marking-Menu.svg?branch=master)](https://travis-ci.org/QuentinRoy/Marking-Menu)
[![codecov](https://img.shields.io/codecov/c/github/QuentinRoy/Marking-Menu.svg)](https://codecov.io/gh/QuentinRoy/Marking-Menu)

This library is an implementation of Gordon Kurtenbach's infamous Marking Menus in JavaScript [[1](https://doi.org/10.1145/120782.120797), [2](http://doi.acm.org/10.1145/169059.169426), [3](http://doi.acm.org/10.1145/191666.191759)].

[Have a look at the **demo**](quentinroy.github.io/marking-menu/).

## License

This _codebase_ is licensed under the MIT license.
**However**, Marking Menus are concerned by several patents, none of which are owned by the author of this library.
Make sure you have the rights to include this library in your application before doing so.
The authors and contributors of this library may not be held responsible for any patent infringement following the use of this codebase.

## Dependencies

- [`rxjs`](http://reactivex.io/rxjs/).

## Install

### Browser with CDN

You can use [unpkg](https://unpkg.com) to fetch both [`rxjs`](http://reactivex.io/rxjs/) and `marking-menu`:

- https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.js,
- https://unpkg.com/marking-menu (latest script),
- https://unpkg.com/marking-menu/marking-menu.css (latest stylesheet)

```html
<!DOCTYPE html>
<html>
  <head>
    <link
      href="https://unpkg.com/marking-menu/marking-menu.css"
      rel="stylesheet"
    />
    <script
      src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.js"
      defer
    ></script>
    <script src="https://unpkg.com/marking-menu" defer></script>
    <script defer>
      // Your stuff.
    </script>
  </head>
  <body></body>
</html>
```

### ES modules or CommonJS with NPM (`webpack` and others)

```sh
npm install -S marking-menu
```

Then (ES modules)

```js
import MarkingMenu from 'marking-menu';
```

or (CommonJS)

```js
var MarkingMenu = require('marking-menu');
```

Don't forget to include the CSS.
For example, if you are using `webpack` and `style-loader`, `import 'marking-menu/marking-menu.css'` should be enough.

## API

### `MarkingMenu(items, parentDOM): Observable`

`MarkingMenu` returns a 'hot' [`Observable`](https://github.com/tc39/proposal-observable) that emits notification of the form `{ name, angle }`. The menu is activated upon subscription of this observable, and disabled upon un-subscription.

- `items`: `Array` of `string` or `{ name, children }`. The list of the menu's items. If `children` is provided, the item will be considered as a sub-menu (`children` has the same form as `items`). Currently, `MarkingMenu` supports up to 8 items per level. The first item is on the right and the followings are layed out clockwise.

- `parentDOM`: `HTMLElement`. The container of the menu.

#### Example

```js
// Create the menu with a sub-menu at the bottom.
const items = [
  'Item Right',
  {
    name: 'Others...',
    children: ['Sub Right', 'Sub Down', 'Sub Left', 'Sub Top'],
  },
  'Item Left',
  'Item Up',
];
const mm = MarkingMenu(items, document.getElementById('main'));

// Subscribe (and activates) the menu.
const subscription = mm.subscribe((selection) => {
  // Do something.
  console.log(selection.name);
});

setTimeout(() => {
  // Later, disable the menu.
  subscription.unsubscribe();
}, 60 * 1000);
```
