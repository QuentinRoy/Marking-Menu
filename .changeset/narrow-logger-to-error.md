---
'marking-menu': major
---

Narrow `MarkingMenuLogger` to `{ error: (error: unknown) => void }`. Previously
overriding the logger required supplying `info`, `warn` and `debug` alongside
`error`, even though `error` is the only method the library ever calls. Any
object exposing an `error` method — `console` included — still satisfies the
type, so most consumers are unaffected; only bespoke loggers that relied on
`error` accepting multiple arguments (rather than a single value) need an
update.
