---
'marking-menu': minor
---

Show a growing pie indicator wherever the library is about to open a menu:
before novice mode starts, when a stroke in expert mode is recognized as a
menu, and when dwelling on a submenu in novice mode. The pie grows from its
starting angle to a full circle over the same dwell it anticipates, then
becomes the novice-mode dot with no visible jump. Its fill defaults to
`--mm-stroke-color` and its faint background circle to `--mm-wedge-fill`;
override either with the new `--mm-indicator-fill` and
`--mm-indicator-background` custom properties.
