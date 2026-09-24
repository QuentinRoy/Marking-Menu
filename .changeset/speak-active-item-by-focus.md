---
'marking-menu': major
---

In novice mode, move focus to the menu and then to the active item, so screen readers announce it. Focus returns where it was when the gesture ends. The focused element gets `blur` and `focusout` events during the gesture.

A menu shown with `menu.open()` takes focus the same way. Each arrow key moves focus that way around the ring rather than along the item order, so the key you press matches the direction you see. Home and End jump to the ends of the item order, Enter selects a leaf or opens a submenu, Escape goes back up a level or closes the menu from the root, and Tab closes it from any level. It also closes when focus moves elsewhere, leaving focus there. Pass `{ focus: false }` to display it without moving focus; it closes on focus loss only after focus enters it. `open` events report this as `event.shouldTakeFocus`.
