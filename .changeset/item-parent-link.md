---
'marking-menu': major
---

Return `null` instead of `undefined` from the root's `parent` property.
Items' `parent` is now precisely typed: for a model built from a literal
menu description, it resolves to the exact ancestor node instead of a loose
one. `AnyModelNode`, `MarkingMenuModelItem` and `ModelRoot` gain the field
in their types, so any code implementing or mocking one of them needs to
supply it.
