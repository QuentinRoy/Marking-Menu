---
'marking-menu': major
---

Narrow `MarkingMenuLogger` to `error`, now taking a single `unknown` argument
rather than varargs. `info`, `warn` and `debug` become optional and ignored,
since nothing in the library ever called them. `console` still satisfies the
type, and `log` can still be overridden partially. Two things break: a logger
whose `error` declares two or more required parameters, and any code that
imported `MarkingMenuLogger` to call `.info()`, `.warn()` or `.debug()` on it.
