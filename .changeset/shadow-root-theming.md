---
'marking-menu': major
---

Render menus in an open shadow root on the existing `.marking-menu` wrapper.
The wrapper now exists for the controller's full lifetime. It contains the menu
and SVG stroke surfaces as sibling layers. Page-level legacy class selectors no
longer reach the menu. Replace the label and connector theme properties with the
`--mm-*` names. Internal menu elements are not a styling API. Use
`--mm-outer-connector-color-active` when the active outer connector should differ
from its resting color.

Replace the nine stroke appearance options with `--mm-stroke-*` custom
properties. Strokes can paint outside the parent without changing scroll
extents. Set `overflow: hidden` on the parent to keep the clipping behavior
from version 0.10.1. `gestureFeedbackDuration` remains an option.

Replace `--mm-ring-radius` with `--mm-wedge-thickness`. The default is 40px,
which sets the radial thickness beyond `deadZoneRadius`.

The center-to-wedge connector is transparent by default. Set
`--mm-inner-connector-color` to show it; use `--mm-outer-connector-color` for
the wedge-to-plate connector.
