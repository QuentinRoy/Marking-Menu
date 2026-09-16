---
'marking-menu': major
---

Restyle the default menu. Wedges and plates now use a pale neutral fill in
light mode and a dark neutral fill in dark mode, with black or near-white
labels. Wedges get a `1px` gray inset outline, and the active item gets a blue
fill and a darker blue outline. Only the active item has a hue.

`--mm-outline-color` and `--mm-outline-color-active` no longer follow the fill
colors, plates have no outline by default, and outer connectors now follow the
fill colors. `--mm-outer-connector-color-active` no longer falls back to
`--mm-outer-connector-color`. The opening indicator background is now black at
20% opacity, or white in dark mode, instead of the muted color. The clearance
between a plate and the ring defaults to `8px`.

Add `--mm-outline-width-active`, `--mm-plate-outline-width-active`, and
`--mm-wedge-outline-width-active` to set outline widths for the active item.
