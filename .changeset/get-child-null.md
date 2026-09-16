---
'marking-menu': major
---

`getChild()` returns `null` instead of `undefined` when no sub-item has the ID. On an item without sub-items, `getChild()` and `getNearestChild()` return `null` instead of throwing.
