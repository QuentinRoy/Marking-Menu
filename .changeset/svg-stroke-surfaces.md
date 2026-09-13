---
'marking-menu': major
---

Gesture strokes can now paint outside their parent so they follow the same
overflow behavior as the menu.

Set `overflow: hidden` on the parent when the menu and strokes must stay within
it, and use the `--mm-stroke-*` custom properties instead of the removed stroke
options.
