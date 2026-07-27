---
'marking-menu': major
---

Stop assigning generated positional IDs to menu items. Items without a
caller-provided ID now expose `id: undefined`; provide an explicit ID when an
item must be addressed by ID. Positional identity is available separately as
the library-assigned `key` property.
