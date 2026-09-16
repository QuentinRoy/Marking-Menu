---
'marking-menu': major
---

pr: #126
commit: 5a46547

Pass a single configuration object instead of positional arguments: `createMarkingMenu({ items, parent, ...options })` instead of `MarkingMenu(items, parent, options)`.
