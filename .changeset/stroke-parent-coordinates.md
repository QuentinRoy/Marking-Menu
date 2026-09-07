---
'marking-menu': patch
---

Draw strokes relative to the parent rather than to the viewport. The renderer
already placed the menu relative to its parent, but passed the stroke, its
origin marker and the completed-gesture trace straight through in the client
coordinates they arrive in, so all three were offset by the parent's own
position. Only a parent at the viewport's top-left was unaffected.
