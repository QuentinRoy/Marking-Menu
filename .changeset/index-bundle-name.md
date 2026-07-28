---
'marking-menu': patch
---

The bundle is now `dist/index.js` instead of `dist/marking-menu.js`. Importing
`marking-menu` is unaffected. Code that loads the file by path, such as an
import map or a pinned CDN URL, needs updating.
