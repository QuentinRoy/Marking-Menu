---
'marking-menu': minor
---

Ship TypeScript declarations. Items in events are typed from the items you pass, so their `id` and `label` narrow to the values you wrote. Nodes now use `ModelRoot`, `ModelItem`, and `ModelNode`; `ModelLeaf` and `ModelMenu` describe leaf and non-leaf nodes. Event `selection`, `active`, and `menu` payloads expose those types directly.
