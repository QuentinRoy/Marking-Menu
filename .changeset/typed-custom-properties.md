---
'marking-menu': major
---

Register the internal custom properties that every `--mm-*` property
documented under Appearance resolves into with
[`@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property),
so a browser that supports it falls back to the documented default when a
`--mm-*` value is invalid, instead of resetting the property that reads it
to that property's own initial value. Registering the resolved property
rather than the public one covers every `--mm-*` property uniformly,
including ones whose default mirrors another `--mm-*` property, such as
`--mm-wedge-fill`.

The library's own default colors now use `hwb()` instead of hex, matching
the color notation used throughout the README.
