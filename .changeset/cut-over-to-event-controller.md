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

The controller emits `start`, `open`, `move`, `change`, `select`, and `cancel` events, exported as classes such as `MarkingMenuSelectEvent`. Their fields are getters, so spreading an event or `JSON.stringify()` doesn't copy them. They replace the `notifySteps` option, with these differences: `draw` becomes `move`, `move` also fires alongside `change`, `cancel` has no `selection`, `select` has no `active`, and no event has `timeStamp`.

`menu.open()` displays the menu without a gesture and lets the keyboard operate it, and `menu.close()` closes it. Pass `{ position }`, in client pixels, to center it somewhere other than the parent's center. Events from such a menu have `mode: 'standalone'` and a `position` of `undefined`, so check `mode` before reading `position`. When a stroke was recognized, `open`, `select`, and `cancel` events have a `recognition` with the stroke and how it was cut into corners and segments. The package exports the new `MarkingMenuOpenOptions`, `MarkingMenuRecognition`, `MarkingMenuStrokeAnalysis`, and `MarkingMenuStrokeSegment` types.
