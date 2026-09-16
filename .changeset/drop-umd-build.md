---
'marking-menu': major
---

Ship only an ES module. The UMD build is gone, with its CommonJS, AMD, and `window.MarkingMenu` global loading. Every supported browser loads ES modules natively: use `import` or `<script type="module">`.
