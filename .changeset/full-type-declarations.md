---
'marking-menu': patch
---

Fix the published type declarations, which only carried part of the public
API. The model, input and event types — `AnyModelNode`, `MarkingMenuInput`,
`MarkingMenuItemInput`, `MarkingMenuModel`, `MarkingMenuModelItem`,
`ModelItem`, `ModelItems`, `ModelLeaves`, `ModelMenus`, `ModelNodes`,
`ModelRoot`, and everything the event classes bring with them — can now be
imported.
