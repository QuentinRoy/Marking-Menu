---
'marking-menu': major
---

Render the menu in an open shadow root on the `.marking-menu` element, so page styles can't break its layout. Page CSS can no longer reach the menu's inner elements, and the theme properties are renamed to `--mm-*`, set on `.marking-menu`. See [Upgrading from 0.10.1](https://github.com/QuentinRoy/Marking-Menu#upgrading-from-0101) for the replacements.
