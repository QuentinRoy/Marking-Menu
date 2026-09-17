---
'marking-menu': major
---

Type `MarkingMenuLogger`'s `info`, `warn`, and `debug` as `(message: string) => void` instead of `unknown`, so the library can start calling them without a later breaking change.
