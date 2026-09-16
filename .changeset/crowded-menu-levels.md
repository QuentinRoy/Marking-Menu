---
'marking-menu': major
---

pr: #273
commit: 2381311

`createMarkingMenu` throws when items in a level are less than 45° apart, such as a level with more than 8 items, because directions that close together can't be told apart.
