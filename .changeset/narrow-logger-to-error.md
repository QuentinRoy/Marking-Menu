---
'marking-menu': major
---

Narrow `MarkingMenuLogger` to `error`, now taking a single `Error` argument
rather than varargs of `unknown`. Errors are normalized before reaching it, so
a handler typed to expect an `Error` can be passed directly. `info`, `warn`
and `debug` become optional and ignored, since nothing in the library ever
called them. `console` still satisfies the type, and `log` can still be
overridden partially. Three things break: a logger whose `error` expects
something other than (or in addition to) an `Error`, a logger whose `error`
declares two or more required parameters, and any code that imported
`MarkingMenuLogger` to call `.info()`, `.warn()` or `.debug()` on it.
