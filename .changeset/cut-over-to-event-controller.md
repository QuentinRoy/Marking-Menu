---
'marking-menu': major
---

`createMarkingMenu` no longer returns an RxJS `Observable`. It returns an
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
