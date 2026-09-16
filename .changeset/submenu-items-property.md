---
'marking-menu': major
---

Rename `children` to `items`, on the items you pass and on the items the menu returns, to match the top-level `items` option. Items without sub-items return `items: []` instead of `undefined`.
