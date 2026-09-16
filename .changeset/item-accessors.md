---
'marking-menu': major
---

pr: #138
commit: c150389

Items expose their fields through getters instead of own properties, so spreading an item, `Object.keys()`, or `structuredClone()` no longer copies them. Read the fields you need explicitly.
