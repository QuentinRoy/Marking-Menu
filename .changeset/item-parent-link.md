---
'marking-menu': major
---

Menu nodes keep their `parent` property, `null` at the root (previously
`undefined`), now precisely typed: for a model built from a literal menu
description, an item's `parent` resolves to the exact ancestor instead of a
loose one. `AnyModelNode`, `MarkingMenuModelItem` and `ModelRoot` gain the
field in their types, so any code implementing or mocking one of them needs
to supply it.
