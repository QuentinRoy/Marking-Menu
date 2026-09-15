---
'marking-menu': minor
---

Show a growing dot inside a background circle to signal that a menu (or
submenu) is about to open, appearing during the pause before it does. The
dot fills the circle exactly as the menu opens, becoming its start marker
with no visible jump. Style it with the new `--mm-indicator-fill` and
`--mm-indicator-background` custom properties; the background defaults to
a mix of the resting and active wedge fill, weighted toward the active
one.
