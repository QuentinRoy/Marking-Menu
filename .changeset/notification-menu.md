---
'marking-menu': minor
---

Include the opened (sub-)menu as `menu` on `open` notifications, when
`notifySteps` is enabled. Notifications are also typed as a union discriminated
on `type`, so checking `type` narrows the fields available on a notification.
