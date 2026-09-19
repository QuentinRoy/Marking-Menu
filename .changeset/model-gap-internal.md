---
'marking-menu': major
---

Remove `getMinAngularGap()` from `ModelItem` and `ModelRoot`. The method only sets the recognizer corner threshold, so it stays on model nodes at runtime but is no longer part of the public model types.
