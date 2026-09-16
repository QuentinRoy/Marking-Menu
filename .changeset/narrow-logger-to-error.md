---
'marking-menu': patch
---

A `log` option without an `error` method falls back to `console.error`, and `error` always receives an `Error`.
