---
'marking-menu': minor
---

Resting wedges, plates, and outer connectors now share a darker fill by
default, `hwb(0 50% 50%)` (3.98:1 against a white page), with white plate
and label text, so the wedge marks its activation area. The active state
is unchanged.

Four new custom properties let a host draw an inset outline instead:
`--mm-wedge-outline-color`, `--mm-wedge-outline-width`,
`--mm-plate-outline-color`, and `--mm-plate-outline-width`. Both widths
default to `0`, off.

The opening indicator's background circle no longer tracks the resting
wedge fill alone: it now defaults to a mix of the resting and active wedge
fill, so its growing dot stays visible against it.
