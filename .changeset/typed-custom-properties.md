---
'marking-menu': minor
---

The library's own default colors use `hwb()` instead of hex, matching
the color notation used throughout the README.

Plate background and label color default to a darker `hwb(0 50% 50%)`
and white instead of near-white and dark gray; wedges and outer
connectors follow, since both already default to the plate background.
The active state is unchanged.

`--mm-wedge-outline-*` and `--mm-plate-outline-*`, each with its own
`-active` color variant, let a host draw an inset outline instead; both
widths default to `0`, off.
