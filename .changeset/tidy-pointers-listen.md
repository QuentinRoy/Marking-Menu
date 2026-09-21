---
'marking-menu': major
---

Handle input with Pointer Events. Only the primary mouse button, touch, or pen starts a gesture, so right and middle clicks no longer open the menu, and a second touch no longer ends it. A gesture keeps tracking when the pointer leaves the parent, and always cancels when the browser cancels the pointer. The parent gets `touch-action: none` until you dispose the menu.

While a menu shown with `menu.open()` is displayed, pointer input goes to the page and no gesture starts.
