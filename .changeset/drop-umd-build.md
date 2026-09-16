---
'marking-menu': major
---

Ship only an ES module. The UMD build is gone, with `require('marking-menu')`, AMD, and the `window.MarkingMenu` global. Every supported browser loads ES modules natively: use `import` or `<script type="module">`.
