---
'marking-menu': major
---

Type `MarkingMenuNotification` as a discriminated union on `type`
(`'start' | 'draw' | 'open' | 'move' | 'change' | 'select' | 'cancel'`),
typing `menu`, `active` and `selection` against the menu model instead of
`unknown`. `selection` on a `'select'` notification is always a leaf item.
