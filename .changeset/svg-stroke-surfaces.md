---
'marking-menu': major
---

pr: #334
commit: 3413aa3c830e2db82770402d91ba1384363e2bca

Strokes are no longer clipped to the parent, like the menu itself. Set `overflow: hidden` on the parent to keep both inside it. The `.marking-menu` element now stays in the parent until you dispose the menu, so its presence no longer means a menu is open.
