---
'marking-menu': major
---

Stop generating IDs for items without one: their `id` is now `undefined` instead of a positional ID like `'1-0'`. Give an item an `id` if you look it up by ID. The positional ID moves to the new `key` property.
