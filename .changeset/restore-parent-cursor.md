---
'marking-menu': patch
---

pr: #193
commit: a87240825aa8999253dda6c7e6157affbcc215a6

Hide the cursor during gestures instead of showing a crosshair, and restore the parent's own inline `cursor` afterward instead of clearing it.
