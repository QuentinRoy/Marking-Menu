---
'marking-menu': major
---

Register the `--mm-*` custom properties documented under Appearance with
[`@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property),
so a browser that supports it falls back to the documented default when a
value is invalid, instead of resetting the property that reads it to that
property's own initial value. Properties whose default mirrors another
`--mm-*` property, such as `--mm-wedge-fill`, stay unregistered so that
mirroring keeps working.

The library's own default colors now use `hwb()` instead of hex, matching
the color notation used throughout the README.
