---
'marking-menu': patch
---

Remove the `raf-schd` dependency. `marking-menu` bundles it into its own
output already, so declaring it as a `dependency` only made consumers
install it a second time for nothing; it's replaced by an internal
equivalent.
