---
'marking-menu': patch
---

The recognizer's corner threshold now derives from the menu's smallest actual
angular gap instead of from the item count. The old formula, `360 / breadth /
2`, assumed items are spaced evenly, so a menu's step size equals `360`
divided by its item count. Once items can be laid out at arbitrary angles,
that assumption no longer holds, and the item count can no longer stand in
for the actual spacing. Every menu shipped today is still spaced evenly, so
this changes nothing observable.
