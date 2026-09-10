---
'marking-menu': minor
---

Labels now solve a compact, conflict-free layout when a menu is created
instead of sitting at a fixed shared radius. Item directions, cyclic order,
and gesture mapping are unchanged; only where each label renders relative to
that direction can shift. A menu stays laid out for its lifetime; recreate
it (as this library already does on item, label, font, or style changes) to
relayout.
