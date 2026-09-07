---
'marking-menu': major
---

Replace `minSelectionDist` and `minMenuSelectionDist` with a single
`deadZoneRadius` option, defaulting to 40. An item becomes active once the
pointer leaves that radius, and pausing on it there opens its submenu. The
band between the two old distances, where an item was active but a pause did
nothing, is gone. Both old names are ignored.

Raise `submenuOpeningDelay` to `1000 / 3`, matching `noviceDwellingTime`, so
both pauses last the same time.
