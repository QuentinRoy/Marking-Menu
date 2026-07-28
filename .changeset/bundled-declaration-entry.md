---
'marking-menu': patch
---

Roll the bundled type declarations up from the package entry, and publish them
as `dist/index.d.ts`. The rollup used to start from `src/marking-menu.ts`
instead of `src/index.ts`, so the published declarations were missing every
type the entry adds on top of it: `AnyModelNode`, `MarkingMenuInput`,
`MarkingMenuItemInput`, `MarkingMenuModel`, `MarkingMenuModelItem`,
`ModelItem`, `ModelItems`, `ModelLeaves`, `ModelMenus`, `ModelNodes` and
`ModelRoot` are now importable, and the internal `exportNotification` no longer
leaks into them.
