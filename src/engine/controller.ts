import type {
  MarkingMenuEventEmitter,
  MarkingMenuEventMap,
} from '../events.js';
import type { MarkingMenuLogger } from '../marking-menu.js';
import {
  createModel,
  type MarkingMenuModel,
  type ValidateInput,
} from '../model.js';
import type { TypedEventListener } from '../typed-event-emitter.js';
import type { AnyModelNode, MarkingMenuInput } from '../types.js';
import { noOp } from '../utils.js';
import { createPointerSource, type PointerSource } from './pointer-source.js';
import { createRenderer, type RendererOptions } from './renderer.js';
import { createRuntime, type NavigationRuntime } from './runtime.js';

export type EngineConfig = MarkingMenuInput &
  Omit<RendererOptions, 'parent'> & {
    /**
    The parent node.
    */
    readonly parent: HTMLElement;
    /**
     The minimum distance between two points to be considered a significant
     movement, switching startup to expert mode and breaking the submenu
     dwelling delay.
     */
    readonly movementsThreshold?: number;
    /**
    The dwelling time required to trigger novice mode (and open the menu).
    */
    readonly noviceDwellingTime?: number;
    /**
    The minimum distance from the center to select an item.
    */
    readonly minSelectionDist?: number;
    /**
    The minimum distance from the center to open a sub-menu.
    */
    readonly minMenuSelectionDist?: number;
    /**
    The dwelling delay before opening a sub-menu.
    */
    readonly submenuOpeningDelay?: number;
    /**
    Override the default logger used to report internal failures.
    */
    readonly log?: Partial<MarkingMenuLogger>;
  };

const defaultLogger: MarkingMenuLogger = {
  error: console?.error?.bind(console) ?? noOp,
};

/**
 `dispose()` is the whole disposal contract, both terminal and idempotent;
 `[Symbol.dispose]()` delegates to it so `using controller = createController(
 config)` works wherever Explicit Resource Management is supported. Neither
 patches `Symbol` nor ships a polyfill: a consumer without native support
 cannot even parse a `using` call site and owns any transpilation it needs.
 */
export type MarkingMenuController<M extends AnyModelNode> =
  MarkingMenuEventEmitter<M> & {
    dispose(): void;
    [Symbol.dispose](): void;
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
    // `config` structurally satisfies `RendererOptions` — it carries every
    // styling option `EngineConfig` intersects in, plus fields the renderer
    // ignores (`items`, the machine options, `log`).
    const renderer = createRenderer<MarkingMenuModel<Config>>(config);
    this.#runtime = createRuntime<MarkingMenuModel<Config>>({
      model,
      options: {
        movementsThreshold: config.movementsThreshold ?? 5,
        noviceDwellingTime: config.noviceDwellingTime ?? 1000 / 3,
        minSelectionDist: config.minSelectionDist ?? 40,
        minMenuSelectionDist: config.minMenuSelectionDist ?? 80,
        submenuOpeningDelay: config.submenuOpeningDelay ?? 100,
      },
      renderer,
      log: { ...defaultLogger, ...config.log },
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

  [Symbol.dispose](): void {
    this.dispose();
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
