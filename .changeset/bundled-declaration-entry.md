---
'marking-menu': patch
---

Fix the published type declarations, which only carried part of the public
API. The model and input types — `AnyModelNode`, `MarkingMenuInput`,
`MarkingMenuItemInput`, `MarkingMenuModel`, `MarkingMenuModelItem`,
`ModelItem`, `ModelItems`, `ModelLeaves`, `ModelMenus`, `ModelNodes` and
`ModelRoot` — can now be imported. The bundle is also renamed to
`dist/index.js`, which only matters when loading it by path rather than
through the package's exports.
