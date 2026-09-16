---
'marking-menu': major
---

Render the menu in an open shadow root on the `.marking-menu` element, so page styles, such as a `box-sizing: border-box` reset, can't break its layout. Page CSS can no longer reach the menu's inner elements, and the theme properties are renamed to `--mm-*`, set on `.marking-menu`. The `.marking-menu` element now stays in the parent until you dispose the menu, so its presence no longer means a menu is open. See [Upgrading from 0.10.1](https://github.com/QuentinRoy/Marking-Menu#upgrading-from-0101) for the replacements.
