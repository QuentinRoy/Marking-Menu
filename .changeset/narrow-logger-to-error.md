---
'marking-menu': patch
---

`MarkingMenuLogger`'s `error` now takes a single `unknown` argument instead of
varargs, matching how it's actually called. `info`, `warn` and `debug` are now
optional and ignored; `console` still satisfies the type, and `log` can be
partially overridden, `error` included.
