---
'marking-menu': major
---

pr: #126
commit: 5a46547dadd7fc3855b858dcb74fed359a5fc0a1

Pass a single configuration object instead of positional arguments: `createMarkingMenu({ items, parent, ...options })` instead of `MarkingMenu(items, parent, options)`.
