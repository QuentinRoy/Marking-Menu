---
'marking-menu': major
---

The bundle is now `dist/index.js` instead of `dist/marking-menu.js`. Importing
`marking-menu` is unaffected, but code that loads the file by path needs
updating: an import map, or a CDN URL pinned to the file name.
