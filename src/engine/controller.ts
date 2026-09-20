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
import type { MarkingMenuInput, ModelNode } from '../types.js';
import { manageFocus, type FocusManager } from './focus.js';
import {
  defaultLogger,
  type MarkingMenuLogger,
  type ResolvedLogger,
} from './logger.js';
import { createPointerSource, type PointerSource } from './pointer-source.js';
import { createRenderer } from './renderer.js';
import { createRuntime, type NavigationRuntime } from './runtime.js';

export type EngineConfig = MarkingMenuInput & {
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
   The radius around the menu center within which no item is active. Past
   it an item becomes active, and dwelling on it opens its sub-menu.
   */
  readonly deadZoneRadius?: number;
  /**
  The dwelling delay before opening a sub-menu.
  */
  readonly submenuOpeningDelay?: number;
  /**
  The duration a completed-gesture feedback trace stays visible, in ms.
  */
  readonly gestureFeedbackDuration?: number;
  /**
  Override the default logger used to report internal failures.
  */
  readonly log?: MarkingMenuLogger;
};

/**
Every {@link EngineConfig} option with its default filled in.
*/
type ResolvedEngineOptions = {
  movementsThreshold: number;
  noviceDwellingTime: number;
  deadZoneRadius: number;
  submenuOpeningDelay: number;
  gestureFeedbackDuration: number;
  log: ResolvedLogger;
};

/**
 Fill in every {@link EngineConfig} default, once, so the renderer, runtime
 and machine each receive an already-resolved value instead of guessing at
 the same default independently.
 */
export function resolveEngineOptions(
  config: EngineConfig,
): ResolvedEngineOptions {
  return {
    movementsThreshold: config.movementsThreshold ?? 5,
    noviceDwellingTime: config.noviceDwellingTime ?? 1000 / 3,
    deadZoneRadius: config.deadZoneRadius ?? 40,
    submenuOpeningDelay: config.submenuOpeningDelay ?? 1000 / 3,
    gestureFeedbackDuration: config.gestureFeedbackDuration ?? 1000,
    log: { ...defaultLogger, ...config.log },
  };
}

/**
 `dispose()` is the whole disposal contract, both terminal and idempotent;
 `[Symbol.dispose]()` delegates to it so `using controller = createController(
 config)` works wherever Explicit Resource Management is supported. Neither
 patches `Symbol` nor ships a polyfill: a consumer without native support
 cannot even parse a `using` call site and owns any transpilation it needs.
 */
export type MarkingMenuController<Model extends ModelNode = ModelNode> =
  MarkingMenuEventEmitter<Model> & {
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
  readonly #focusManager: FocusManager;
  #disposed = false;

  constructor(config: Config & ValidateInput<Config>) {
    // Explicit `createModel<Config>` rather than annotating the result:
    // inference would pick up the `Config & ValidateInput<Config>` parameter
    // type as `Input`, and `MarkingMenuModel` of that is a different type.
    const model = createModel<Config>(config);
    const options = resolveEngineOptions(config);
    const renderer = createRenderer({
      parent: config.parent,
      deadZoneRadius: options.deadZoneRadius,
      gestureFeedbackDuration: options.gestureFeedbackDuration,
    });
    this.#runtime = createRuntime<MarkingMenuModel<Config>>({
      model,
      options: {
        movementsThreshold: options.movementsThreshold,
        noviceDwellingTime: options.noviceDwellingTime,
        deadZoneRadius: options.deadZoneRadius,
        submenuOpeningDelay: options.submenuOpeningDelay,
      },
      renderer,
      log: options.log,
    });
    this.#pointerSource = createPointerSource({
      parent: config.parent,
      runtime: this.#runtime,
    });
    this.#focusManager = manageFocus({
      doc: config.parent.ownerDocument,
      getMenu: renderer.getMenu,
      runtime: this.#runtime,
    });
  }

  on<Name extends EventName<Config>>(
    type: Name,
    listener: TypedEventListener<EventMap<Config>, Name>,
  ): void {
    this.#runtime.on(type, listener);
  }

  off<Name extends EventName<Config>>(
    type: Name,
    listener: TypedEventListener<EventMap<Config>, Name>,
  ): void {
    this.#runtime.off(type, listener);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#focusManager.dispose();
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
