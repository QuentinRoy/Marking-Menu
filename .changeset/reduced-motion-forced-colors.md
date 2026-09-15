---
'marking-menu': minor
---

The opening indicator now respects `prefers-reduced-motion: reduce`: its
dot fades in at a fixed size over the dwell instead of growing, since WCAG
doesn't count an opacity change as motion.

Under `forced-colors: active`, every painted part of the menu (wedges,
plates, outlines, connectors, the gesture stroke, and the opening
indicator) switches to system colors instead of the page's own theme.
