---
'marking-menu': patch
---

Rename the bundle to `dist/index.js`. Importing `marking-menu` is unaffected;
this only matters when loading the file by path, as an import map or a CDN URL
pinned to the file name does.
