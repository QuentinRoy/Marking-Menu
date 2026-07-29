import type { MarkingMenuEventEmitter, MarkingMenuEventMap } from '../events.js';
import {
  createModel,
  type MarkingMenuModel,
  type ValidateInput,
} from '../model.js';
import type { TypedEventListener } from '../typed-event-emitter.js';
import type { AnyModelNode, MarkingMenuInput } from '../types.js';
import { createPointerSource, type PointerSource } from './pointer-source.js';
import { createRenderer } from './renderer.js';
import { createRuntime, type NavigationRuntime } from './runtime.js';

export type EngineConfig = MarkingMenuInput & {
  readonly parent: HTMLElement;
  readonly movementsThreshold?: number;
};

export type MarkingMenuController<M extends AnyModelNode> =
  MarkingMenuEventEmitter<M> &
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

 It assembles the engine and owns its lifetime; it does not originate events.
 Interpreting the machine's `dispatch` commands is what produces those, and
 that happens in the runtime, which owns the emitter accordingly — `on`/`off`
 below are a facade over it. Emitting is unreachable from here, so consumers
 get a listen-only surface with no private-field bookkeeping to enforce it.
 */
class Controller<Config extends EngineConfig> implements MarkingMenuController<
  MarkingMenuModel<Config>
> {
  readonly #pointerSource: PointerSource;
  readonly #runtime: NavigationRuntime<MarkingMenuModel<Config>>;
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
      renderer,
    });
    this.#pointerSource = createPointerSource({
      parent: config.parent,
      runtime: this.#runtime,
    });
  }

  on<K extends EventName<Config>>(
    type: K,
    listener: TypedEventListener<EventMap<Config>, K>,
  ): void {
    this.#runtime.on(type, listener);
  }

  off<K extends EventName<Config>>(
    type: K,
    listener: TypedEventListener<EventMap<Config>, K>,
  ): void {
    this.#runtime.off(type, listener);
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
 {@link MarkingMenuEventEmitter}.

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
