---
'marking-menu': major
---

Add a `parent` property to menu nodes: `null` at the root, and the immediate
containing node for every item. `AnyModelNode`, `MarkingMenuModelItem` and
`ModelRoot` gain the field, so any code implementing or mocking those types
needs to supply it.
