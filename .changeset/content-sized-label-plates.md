---
'marking-menu': major
---

Size label plates to their text by default. Set both `--mm-label-min-width`
and `--mm-label-max-width` to `120px` to keep the prior fixed, truncated
plate. Plate height now follows its label, so `--mm-plate-height` no longer
applies. The `plate` part now contains the `label` part, which styles text
only.
All plate corners now use `--mm-plate-corner-radius`, and plate padding now
defaults to `8px` where `text-box-trim` and `text-box-edge` are available.
Browsers without trimming add `0.2em` to the default or configured padding.
