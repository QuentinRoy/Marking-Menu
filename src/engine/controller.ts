import type { MarkingMenuEventTarget } from '../events.js';
import {
  createModel,
  type MarkingMenuModel,
  type ValidateInput,
} from '../model.js';
import type { AnyModelNode, MarkingMenuInput } from '../types.js';
import { createPointerSource } from './pointer-source.js';
import { createRenderer } from './renderer.js';
import { createRuntime } from './runtime.js';

export type EngineConfig = MarkingMenuInput & {
  readonly parent: HTMLElement;
  readonly movementsThreshold?: number;
};

export type MarkingMenuController<M extends AnyModelNode> =
  MarkingMenuEventTarget<M> & {
    dispose: () => void;
    [Symbol.dispose]: () => void;
  };

/**
 The internal engine's entry point. Not reachable from `createMarkingMenu`
 until the cutover ticket (https://github.com/QuentinRoy/Marking-Menu/issues/184).
 */
class Controller extends EventTarget {
  readonly #pointerSource: ReturnType<typeof createPointerSource>;
  readonly #runtime: ReturnType<typeof createRuntime>;
  #disposed = false;

  constructor(config: EngineConfig & ValidateInput<EngineConfig>) {
    super();
    const model = createModel(config);
    const renderer = createRenderer({ parent: config.parent });
    this.#runtime = createRuntime({
      model,
      options: { movementsThreshold: config.movementsThreshold ?? 5 },
      target: this,
      renderer,
    });
    this.#pointerSource = createPointerSource({
      parent: config.parent,
      runtime: this.#runtime,
    });
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
 {@link MarkingMenuEventTarget}. `Controller` implements the facade
 structurally rather than by overriding `addEventListener` — see the
 rationale on `MarkingMenuEventTarget` in `src/events.ts`.
 */
export function createController<const Config extends EngineConfig>(
  config: Config & ValidateInput<Config>,
): MarkingMenuController<MarkingMenuModel<Config>> {
  return new Controller(config) as MarkingMenuController<
    MarkingMenuModel<Config>
  >;
}
