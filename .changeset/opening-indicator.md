---
'marking-menu': minor
---

Show a growing pie indicator before novice mode opens: while dwelling before
the first menu appears, and while dwelling on a submenu once one is already
open. The pie grows from its starting angle to a full circle over the same
dwell it anticipates, then becomes the novice-mode dot with no visible
jump. The pointer's cursor is hidden while it grows, the same way novice
mode already hides it. Expert mode shows no indicator and keeps its
crosshair cursor, since a stroke fast enough to stay there rarely dwells
long enough for one to matter. The pie's fill defaults to
`--mm-stroke-color` and its faint background circle to `--mm-wedge-fill`;
override either with the new `--mm-indicator-fill` and
`--mm-indicator-background` custom properties.
