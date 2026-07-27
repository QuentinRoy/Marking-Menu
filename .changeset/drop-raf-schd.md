---
'marking-menu': patch
---

Remove the `raf-schd` dependency, replaced with an equivalent internal
implementation. No behavior change; `raf-schd` just no longer shows up in
consumers' `node_modules` or dependency audits.
