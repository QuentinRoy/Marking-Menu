/*
 A reusable, listen-only typed event emitter contract. Not DOM's
 `EventTarget`: no listener options, no capture/once/signal, no `this`
 rebinding, and events need not extend `Event`.
 */

/** The minimal shape any event needs to be routed by its `type`. */
export type EventLike = { readonly type: string };

/** A listener for one event name `K` in `EventMap`. */
export type TypedEventListener<
  EventMap extends Record<string, EventLike>,
  K extends keyof EventMap,
> = (event: EventMap[K]) => void;

/**
 No `emit`/`dispatch`: whatever exposes this stays the only thing that can
 raise an event.

 Expose it with `implements`, never by extending a class that has one:
 narrowing `on`'s listener parameter on a subclass fails TypeScript's
 override-compatibility check against the wider base signature.
 */
export type TypedEventEmitter<EventMap extends Record<string, EventLike>> = {
  on<K extends keyof EventMap>(
    type: K,
    listener: TypedEventListener<EventMap, K>,
  ): void;

  off<K extends keyof EventMap>(
    type: K,
    listener: TypedEventListener<EventMap, K>,
  ): void;
};
