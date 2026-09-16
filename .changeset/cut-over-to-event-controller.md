---
'marking-menu': major
---

`createMarkingMenu` returns a controller instead of an RxJS `Observable`, so you no longer install `rxjs`. The menu is active as soon as you create it. Listen with `on(type, listener)`, and stop the menu with `dispose()` or `using`.

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

The controller emits `start`, `open`, `move`, `change`, `select`, and `cancel` events, exported as classes such as `MarkingMenuSelectEvent`. They replace the `notifySteps` option: `draw` notifications become `move` events, and `cancel` reports the last active item as `active` instead of `selection`.
