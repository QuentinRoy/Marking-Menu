---
'marking-menu': major
---

Require caller-provided item IDs to be unique across the entire menu tree.
Duplicate literal IDs are rejected by TypeScript, and duplicate IDs in
dynamically built menus throw when the menu is created.
