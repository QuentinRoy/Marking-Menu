---
'marking-menu': minor
---

Resting wedges, plates, and outer connectors default to a darker shared
fill, `hwb(0 50% 50%)`, with white plate and label text, so the wedge
marks its activation area against a white page. The active state is
unchanged. `--mm-wedge-outline-*` and `--mm-plate-outline-*`, each with
its own `-active` color variant, let a host draw an inset outline
instead; both widths default to `0`, off.

`--mm-indicator-background` now defaults to a mix weighted toward the
active wedge fill, lighter than before, so the growing dot stays visible.
