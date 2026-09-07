---
'marking-menu': patch
---

Stop using `innerHTML` to render menu item labels. A label containing markup
now shows as plain text instead of being parsed as HTML.
