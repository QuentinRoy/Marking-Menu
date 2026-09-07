---
'marking-menu': patch
---

Lay the menu out correctly on a page that resets `box-sizing`. The menu's
stylesheet sizes an item's label by its content and pads around it, and its
positioning arithmetic adds that padding back. Under a host reset making
everything `border-box`, as Tailwind's preflight and normalize both do, the
padding came out of the label instead, leaving its text off centre and its
box off position. The menu now states the box model it assumes.
