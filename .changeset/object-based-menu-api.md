---
'marking-menu': minor
---

Menu items now use a single recursive shape `{ label, children? }`:

- The `name` property is renamed to `label`.
- The string shorthand for menu items is removed; every item must be an object.
- `MMItem#getChildrenByName` is renamed to `getChildrenByLabel`.

`MarkingMenu(items, parentDOM, options)` becomes `MarkingMenu({ items, parent, ...options })`, taking a single options object instead of positional arguments.
