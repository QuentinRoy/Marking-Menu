---
'marking-menu': patch
---

Render correctly when the menu's parent lives in a different document, such
as an iframe. The menu's stylesheet and its computed style reads previously
ran against the caller's own document instead of the parent's, so a menu
mounted in another document picked up the wrong theme, and two
`instanceof HTMLElement` checks could reject perfectly valid elements
belonging to another window.
