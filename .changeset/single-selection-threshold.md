---
'marking-menu': major
---

Replace `minSelectionDist` (default 40) and `minMenuSelectionDist` (default 80) with one `deadZoneRadius` option (default 40). An item becomes active past this radius, and pausing on it opens its submenu. Before, a submenu only opened past `minMenuSelectionDist`. Rename `minSelectionDist` to `deadZoneRadius` and remove `minMenuSelectionDist`; JavaScript silently ignores the old names.
