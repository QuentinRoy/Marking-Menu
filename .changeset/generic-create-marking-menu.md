---
'marking-menu': major
---

Make `createMarkingMenu` generic over its configuration, inferring the menu
model directly from `config.items`. The duplicate-item-id compile check now
also applies at the `createMarkingMenu` call site, not just when building a
model separately: two sibling items sharing a literal id are now a compile
error there too.
