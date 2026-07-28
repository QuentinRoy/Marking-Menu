---
'marking-menu': major
---

Ship a single ES module entry point at `dist/index.js`. Remove the UMD
artifact, including its CommonJS, AMD, and `window.MarkingMenu` loading paths,
and remove the former `marking-menu.mjs` entry point. Browser consumers must
now load the package as an ES module.
