import type { MarkingMenuEventMap, MarkingMenuEventTarget } from '../events.js';
import {
  createModel,
  type MarkingMenuModel,
  type ValidateInput,
} from '../model.js';
import type { AnyModelNode, MarkingMenuInput } from '../types.js';
import { createPointerSource, type PointerSource } from './pointer-source.js';
import { createRenderer } from './renderer.js';
import { createRuntime, type NavigationRuntime } from './runtime.js';

export type EngineConfig = MarkingMenuInput & {
  readonly parent: HTMLElement;
  readonly movementsThreshold?: number;
};

export type MarkingMenuController<M extends AnyModelNode> =
  MarkingMenuEventTarget<M> &
    Disposable & {
      dispose(): void;
    };

/** The event map of the controller a given config produces. */
type EventMap<Config extends EngineConfig> = MarkingMenuEventMap<
  MarkingMenuModel<Config>
>;

/** The event names that map is keyed by. */
type EventName<Config extends EngineConfig> = keyof EventMap<Config> & string;

/**
 The internal engine's entry point. Not reachable from `createMarkingMenu`
 until the cutover ticket (https://github.com/QuentinRoy/Marking-Menu/issues/184).

 Generic in `Config`, not merely in the model it produces: that is what makes
 the event types the engine dispatches *derived* rather than asserted.
 `createModel(config)` below returns `MarkingMenuModel<Config>`, which fixes
 `createRuntime`'s `M`, which fixes the `MarkingMenuEvent<M>` the machine may
 hand to the sink — the same type `createController` declares it returns. A
 non-generic constructor would widen the model to `MarkingMenuModel<EngineConfig>`
 and leave a cast as the only (unchecked) bridge back.

 It *composes* an `EventTarget` rather than extending one, which is what lets
 it `implements` the typed facade with no assertion anywhere — see
 {@link MarkingMenuEventTarget} for why extending cannot carry the narrowing.
 `#events` is private, so dispatching stays internal: consumers get a
 listen-only surface, and the machine's commands are the only thing that ever
 emits.
 */
class Controller<Config extends EngineConfig> implements MarkingMenuController<
  MarkingMenuModel<Config>
> {
  readonly #events = new EventTarget();
  readonly #pointerSource: PointerSource;
  readonly #runtime: NavigationRuntime;
  #disposed = false;

  constructor(config: Config & ValidateInput<Config>) {
    // Both explicit type arguments are load-bearing, not decoration: they are
    // what makes the model a *checked* link rather than an inferred one. Were
    // the model to widen — the old failure mode, when this class took a
    // non-generic `EngineConfig` — `createRuntime`'s `M` would reject it here,
    // instead of the widened model flowing into the machine unnoticed and
    // being papered over by a cast downstream.
    //
    // `createModel<Config>` rather than a `MarkingMenuModel<Config>`
    // annotation on the result: inference would otherwise pick up the
    // `Config & ValidateInput<Config>` parameter type as `Input`, and
    // `MarkingMenuModel` of that is not the same type as of `Config`.
    const model = createModel<Config>(config);
    const renderer = createRenderer({ parent: config.parent });
    this.#runtime = createRuntime<MarkingMenuModel<Config>>({
      model,
      options: { movementsThreshold: config.movementsThreshold ?? 5 },
      target: {
        emit: (event) => {
          this.#events.dispatchEvent(event);
        },
      },
      renderer,
    });
    this.#pointerSource = createPointerSource({
      parent: config.parent,
      runtime: this.#runtime,
    });
  }

  addEventListener<K extends EventName<Config>>(
    type: K,
    listener: (
      this: MarkingMenuEventTarget<MarkingMenuModel<Config>>,
      event: EventMap<Config>[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // `EventTarget`'s own signature is untyped by nature (`Event`, any type
    // string). Narrowing is the whole point of the facade, so the loss is
    // absorbed exactly here, at the delegation boundary — the listener is
    // handed back events of precisely the type it was registered for.
    this.#events.addEventListener(type, listener as EventListener, options);
  }

  removeEventListener<K extends EventName<Config>>(
    type: K,
    listener: (
      this: MarkingMenuEventTarget<MarkingMenuModel<Config>>,
      event: EventMap<Config>[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void {
    this.#events.removeEventListener(type, listener as EventListener, options);
  }

  dispatchEvent(event: Event): boolean {
    return this.#events.dispatchEvent(event);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#pointerSource.dispose();
    this.#runtime.dispose();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 Create the internal engine controller: an already-active object satisfying
 {@link MarkingMenuEventTarget}.

 No type assertion: `Controller<Config>` *is* the declared return type, and
 its `implements` clause is what checks that. The model is derived rather
 than claimed — `createModel(config)` fixes `MarkingMenuModel<Config>`, which
 fixes `createRuntime`'s `M`, which fixes the `MarkingMenuEvent<M>` the
 machine may hand to the sink. `model.ts`'s single documented conversion
 stays the only place precision is re-attached; this path merely carries it.
 */
export function createController<const Config extends EngineConfig>(
  config: Config & ValidateInput<Config>,
): MarkingMenuController<MarkingMenuModel<Config>> {
  return new Controller<Config>(config);
}
