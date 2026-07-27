---
'marking-menu': minor
---

Ship TypeScript declaration files. The package now has a `types` export
condition, and re-exports its model and notification types (`MarkingMenuModel`,
`AnyModelNode`, `ModelItem`, `ModelRoot`, `ModelItems`, `ModelLeaves`,
`ModelMenus`, `ModelNodes`, `MarkingMenuModelItem`, `MarkingMenuInput`,
`MarkingMenuItemInput`) alongside `createMarkingMenu`. `createModel` itself
stays unexported: callers never need to hold a model directly.
