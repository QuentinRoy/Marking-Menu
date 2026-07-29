/*
 A reusable, listen-only typed event emitter: `on`/`off`, narrowed per event
 name, with no `dispatch`/`emit` in the type at all. A class exposes this by
 `implements`ing it while keeping its own `emit` private, so consumers get a
 listen-only surface and the class itself is the only thing that can ever
 raise an event.

 Not DOM's `EventTarget`: no listener options, no capture/once/signal, no
 `this` rebinding, and events need not extend `Event`. `EventLike` is the
 entire event contract this file cares about — just a `type` discriminant.
 */

/** The minimal shape any event needs to be routed by its `type`. */
export type EventLike = { readonly type: string };

/** A listener for one event name `K` in `EventMap`. */
export type TypedEventListener<
  EventMap extends Record<string, EventLike>,
  K extends keyof EventMap,
> = (event: EventMap[K]) => void;

/**
 The listen-only facade a class exposes by `implements`ing this type — never
 by extending a class that has one, since narrowing `on`'s listener
 parameter on a subclass fails TypeScript's override-compatibility check
 against a wider base signature. Declaring it as a standalone type sidesteps
 that check entirely.
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
