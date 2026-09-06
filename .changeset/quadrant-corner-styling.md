---
'marking-menu': patch
---

Style corner items by the quadrant they sit in rather than by an exact angle.
Any item strictly inside a quadrant now gets that quadrant's corner class, so
free-form angles are covered instead of only the four that used to match
exactly. Angles on an axis (0, 90, 180, 270) still get no corner class, and
45/135/225/315 keep the same class as before.
