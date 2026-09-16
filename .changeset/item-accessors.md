---
'marking-menu': major
---

pr: #138
commit: c150389e9a1cc5254d9a42bfeb0c81290474d86e

Items expose their fields through getters instead of own properties, so spreading an item, `Object.keys()`, or `structuredClone()` no longer copies them. Read the fields you need explicitly.
