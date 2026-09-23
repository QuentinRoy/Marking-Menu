---
'marking-menu': major
---

A menu shown with `menu.open()` now also answers the mouse, touch, and pen, alongside the keyboard, and shows a pointer cursor over its items. Hovering an item makes it active without moving focus, and moving off the menu clears it. Clicking a leaf selects it and clicking a submenu item opens it, both giving focus to the new level. Clicking outside the menu, or releasing a drag there, dismisses it.
