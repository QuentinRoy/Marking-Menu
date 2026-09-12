---
'marking-menu': major
---

Render menus in an open shadow root on the existing `.marking-menu` wrapper.
Page-level legacy class selectors no longer reach the menu. Replace the label and
connector theme properties with the `--mm-*` names, and style repeated menu
boxes through the `plate`, `label`, `inner-connector`, and `outer-connector`
parts.

Replace the nine stroke appearance options with `--mm-stroke-*` custom
properties. `gestureFeedbackDuration` remains an option.

The center-to-wedge connector is transparent by default. Set
`--mm-inner-connector-color` to show it; use `--mm-outer-connector-color` for
the wedge-to-plate connector.
