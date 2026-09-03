import type {
  MarkingMenuEventEmitter,
  MarkingMenuEventMap,
} from '../events.js';
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
  readonly noviceDwellingTime?: number;
  readonly minSelectionDist?: number;
};

/*
 No `Disposable`/`[Symbol.dispose]`, deliberately. `using` is syntax, so a
 consumer on a runtime without it cannot even parse the call site, and support
 sits around 70%. `dispose()` is the whole disposal contract; a `using`-capable
 consumer can still wrap this themselves.
 */
export type MarkingMenuController<M extends AnyModelNode> =
  MarkingMenuEventEmitter<M> & {
    dispose(): void;
  };

/**
The event map of the controller a given config produces.
*/
type EventMap<Config extends EngineConfig> = MarkingMenuEventMap<
  MarkingMenuModel<Config>
>;

/**
The event names that map is keyed by.
*/
type EventName<Config extends EngineConfig> = keyof EventMap<Config> & string;

/**
 The internal engine's entry point: assembles the engine and owns its
 lifetime. `on`/`off` are a facade over the runtime, which owns the emitter.

 Generic in `Config`, not merely in the model it produces, so the event types
 are derived from the literal config. A non-generic constructor would widen
 the model to `MarkingMenuModel<EngineConfig>` and leave a cast as the only
 bridge back.

 Not reachable from `createMarkingMenu` until the cutover ticket
 (https://github.com/QuentinRoy/Marking-Menu/issues/184).
 */
class Controller<Config extends EngineConfig> implements MarkingMenuController<
  MarkingMenuModel<Config>
> {
  readonly #pointerSource: PointerSource;
  readonly #runtime: NavigationRuntime<MarkingMenuModel<Config>>;
  #disposed = false;

  constructor(config: Config & ValidateInput<Config>) {
    // Explicit `createModel<Config>` rather than annotating the result:
    // inference would pick up the `Config & ValidateInput<Config>` parameter
    // type as `Input`, and `MarkingMenuModel` of that is a different type.
    const model = createModel<Config>(config);
    const renderer = createRenderer<MarkingMenuModel<Config>>({
      parent: config.parent,
    });
    this.#runtime = createRuntime<MarkingMenuModel<Config>>({
      model,
      options: {
        movementsThreshold: config.movementsThreshold ?? 5,
        noviceDwellingTime: config.noviceDwellingTime ?? 1000 / 3,
        minSelectionDist: config.minSelectionDist ?? 40,
      },
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
    // Runtime first: it unsubscribes, sends `dispose`, and tears down the
    // rendered DOM before the pointer source releases capture and the
    // touch-action claim.
    this.#runtime.dispose();
    this.#pointerSource.dispose();
  }
}

/**
 Create the internal engine controller: an already-active, disposable object
 satisfying {@link MarkingMenuEventEmitter}.
 */
export function createController<const Config extends EngineConfig>(
  config: Config & ValidateInput<Config>,
): MarkingMenuController<MarkingMenuModel<Config>> {
  return new Controller<Config>(config);
}
