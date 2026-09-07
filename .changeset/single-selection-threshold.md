---
'marking-menu': major
---

Replace `minSelectionDist` and `minMenuSelectionDist` with a single
`deadZoneRadius` option, defaulting to 40. An item becomes active once the
pointer leaves that radius, and pausing on it there opens its submenu. The
band between the two old distances, where an item was active but a pause did
nothing, is gone. TypeScript rejects the old names; JavaScript callers
passing them get no warning and no effect.
