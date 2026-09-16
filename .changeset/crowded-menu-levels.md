---
'marking-menu': major
---

pr: #273
commit: 23813114708c542c4e69361d0948b0ad5c464f52

`createMarkingMenu` throws when items in a level are less than 45° apart, such as a level with more than 8 items, because directions that close together can't be told apart. Move extra items into submenus, or space stated angles at least 45° apart.
