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

The controller emits `start`, `open`, `move`, `change`, `select`, and `cancel` events, exported as classes such as `MarkingMenuSelectEvent`. Their fields are getters, so spreading an event or `JSON.stringify()` doesn't copy them. They replace the `notifySteps` option, with these differences: `draw` becomes `move`, `move` also fires alongside `change`, `cancel` has no `selection`, `active` is now `activeItem` and only on `move`, `change`, and `cancel`, and no event has `timeStamp`.

`menu.open()` displays the menu without a gesture. Mouse, touch, pen, and keyboard all operate it, and `menu.close()` closes it. Pass `{ position }`, in viewport pixels, to center it somewhere other than the parent's center. Events from such a menu have `mode: 'standalone'`, and, like novice mode, fire `move` on pointer movement. Every event has a `source`: `'pointer'`, `'keyboard'`, `'gesture'` (drawing a mark), `'api'` (an `open()` or `close()` call), or `'focus-loss'` (the menu lost focus). `position` is a viewport point when `source` is `'pointer'`, and `undefined` otherwise. Check `source`, not `mode`, to know which. When a stroke was recognized, `open`, `select`, and `cancel` events have a `recognition` with the stroke and how it was cut into corners and segments. `cancel` events have a `reason`: `no-selection`, `interrupted` when the browser cancels the pointer, or `dismissed` when a menu shown with `open()` is closed. The package exports the new `MarkingMenuCancelReason`, `MarkingMenuEventSource`, `MarkingMenuOpenOptions`, `MarkingMenuRecognition`, `MarkingMenuStrokeAnalysis`, and `MarkingMenuStrokeSegment` types.
