---
'marking-menu': major
---

In novice mode, move focus to the menu and then to the active item, so screen readers announce it. Focus returns where it was when the gesture ends. The focused element gets `blur` and `focusout` events during the gesture.

A menu shown with `menu.open()` takes focus the same way. Arrow keys, Home, End, Enter, and Escape move through it, and Tab closes it. It also closes when focus moves elsewhere, leaving focus there. Pass `{ focus: false }` to display it without moving focus; it closes on focus loss only after focus enters it.
