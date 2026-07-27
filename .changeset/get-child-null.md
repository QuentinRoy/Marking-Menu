---
'marking-menu': major
---

Return `null` instead of `undefined` from `getChild()` when no direct sub-item
has the requested ID. Calling `getChild()` on a leaf now also returns `null`
instead of throwing.
