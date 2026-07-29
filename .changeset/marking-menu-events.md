---
'marking-menu': minor
---

Export the public event classes and typed, listen-only emitter facade that
the upcoming native event-based API will use: `MarkingMenuStartEvent`,
`MarkingMenuOpenEvent`, `MarkingMenuMoveEvent`, `MarkingMenuChangeEvent`,
`MarkingMenuSelectEvent`, `MarkingMenuCancelEvent`, their shared
`MarkingMenuEventBase`, the `MarkingMenuEventMap`/`MarkingMenuEvent` types, and
`MarkingMenuEventEmitter`.

These events are plain classes, not DOM `Event`s: this library has no DOM
target, bubbling, or default action to prevent, so there is none of that
machinery to carry around. `MarkingMenuEventEmitter` is listen-only: `on`/`off`
narrowed per event name, with no listener options (once/signal/capture) and no
`dispatch`/`emit` in the type at all.
