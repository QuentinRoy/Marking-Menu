---
'marking-menu': major
---

Narrow `MarkingMenuLogger` to `{ error: (error: unknown) => void }`. `info`,
`warn` and `debug` are gone since nothing in the library called them. Anything
with an `error` method, `console` included, still satisfies the type. `log`
stays a partial override, so `error` can still be left out; only a custom
logger whose `error` took more than one argument needs an update.
