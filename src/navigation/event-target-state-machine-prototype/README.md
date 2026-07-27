# EventTarget + state machine prototype

> **PROTOTYPE — throwaway branch, not production code.**

## Question

Can the Observable-dependent interaction layer be replaced wholesale by an
explicit state machine and native `EventTarget`, while leaving the model and
recognizer as pure collaborators and changing layout only from an Observable
operator into an event listener? Can the resulting public events preserve the
menu model's precise leaf/menu types? An async iterator is included only to
test whether it is a useful optional consumer adapter.

Run it:

```sh
yarn prototype:event-target
```

Start with `s`, then try these sequences:

- `s d r u`: dwell into novice mode, point at Open, then select it.
- `s v d r u`: confirm expert mode with a long downward move, dwell into the
  Tools submenu, point at Copy, then select it.
- `s l x d`: enter expert mode, fire the retired startup timer (which must do
  nothing), then fire the current timer.
- `s d v d r u`: enter novice mode, dwell on Tools to open it, then select
  Copy.
- Press `c` from every mode and check that state returns to `idle` with no
  pending timer.

The TUI prints the complete relevant state and the most recent public events
after every action.

## Proposed ownership

| Concern                                  | Owner                                                           |
| ---------------------------------------- | --------------------------------------------------------------- |
| Pointer capture and DOM listener cleanup | Pointer source using native events and one `AbortController`    |
| Legal modes and transitions              | Pure reducer in `machine.ts`                                    |
| Dwell timing and stale timer rejection   | Effects emitted by the reducer, interpreted by `controller.ts`  |
| Gesture recognition and menu hit-testing | Existing recognizer/model behind pure environment functions     |
| Public consumer notifications            | Typed `EventTarget` subclass                                    |
| Layout updates                           | A listener that subscribes to public events and returns cleanup |
| Lifecycle                                | Explicit `dispose()`; not inferred from listener count          |

The important boundary is `transition(state, input, environment, options)`.
It is deterministic and knows nothing about the DOM, `EventTarget`, timers, or
layout. The controller serializes input, commits the next state, and only then
interprets timer and event effects.

## Strong typing result

The public controller is parameterized by three related types:

```ts
NavigationController<Node, Leaf extends Node, Menu extends Node>
```

Its event protocol carries those relationships:

```ts
controller.addEventListener('select', (event) => {
  event.detail.selection; // Leaf
});

controller.addEventListener('open', (event) => {
  event.detail.menu; // Menu
});
```

Native `EventTarget` cannot express an event map. The prototype contains two
localized assertions in `TypedEventTarget.addEventListener` and
`removeEventListener`, where the DOM type erases the protocol. No assertion is
needed by consumers, the machine, or the controller. Invalid event names and
payloads fail at compile time.

The remaining limitation is inherent to subclassing `EventTarget`:
`dispatchEvent(new Event('anything'))` stays public because narrowing a base
class method would violate its contract. The library should expose typed
emission only internally and document consumer events as read-only.

## Async iteration: provisional verdict

`events({ signal, capacity, overflow })` proves that a typed async generator can
be layered over the same events without affecting the core design. It also
exposes three costs:

1. An `EventTarget` never completes, so every iterator needs an `AbortSignal`.
2. Pointer-rate `draw`/`move` events need an explicit bounded-buffer policy.
3. The generator starts listening only when iteration begins, whereas ordinary
   event listeners are naturally eager.

That makes async iteration plausible for a sparse, selection-only convenience
API, but a poor default for the full notification stream. It should be omitted
unless real consumers show that `for await` materially improves their code.

## What this deliberately does not preserve

- Higher-order streams, subscription-driven activation, and operator-shaped
  functions.
- Observable completion as lifecycle. The controller has explicit ownership
  and `dispose()`.
- The current module decomposition. New boundaries follow state, effects, DOM
  input, and output ownership.

The prototype uses a tiny menu and simplified recognition only so the state
model can be driven by hand. Production absorption would reuse the existing
model and recognizer rather than this fixture.
