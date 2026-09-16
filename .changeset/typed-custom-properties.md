---
'marking-menu': minor
---

The library's own default colors use `hwb()` instead of hex, matching
the color notation used throughout the README.

Plate background and label color default to a darker `hwb(0 58% 42%)`
and white instead of near-white and dark gray; wedges and outer
connectors mirror the plate background, using the new
`--mm-fill` and `--mm-fill-active` properties. Activating an
item nudges the fill a touch darker in light mode, and a touch lighter
in dark mode. Colors pick a dark-mode variant using `light-dark()` once
the host page opts in with `color-scheme`.

`--mm-wedge-outline-*` and `--mm-plate-outline-*`, each with its own
`-active` variant, let a host draw an inset outline instead of the fill.
Both fall back to the new `--mm-outline-color`, `--mm-outline-color-active`,
and `--mm-outline-width`, shared between wedges and plates; every width
defaults to `0`, off.
