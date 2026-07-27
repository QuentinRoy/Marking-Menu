/**
 PROTOTYPE: imperative runtime around the pure navigation machine.
 
 This is the only layer that owns time and event dispatch. A future pointer
 source would translate native PointerEvents into `send(...)` calls; layout
 would listen to this controller and return a cleanup function.
 */

import {
  initialNavigationState,
  transition,
  type MachineEffect,
  type MachineEnvironment,
  type MenuNode,
  type NavigationEventProtocol,
  type NavigationInput,
  type NavigationOptions,
  type NavigationState,
  type TimerReference,
} from './machine.ts';
import { TypedEventTarget } from './typed-event-target.ts';

const navigationEventTypes = [
  'start',
  'draw',
  'open',
  'change',
  'move',
  'select',
  'cancel',
] as const;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

type ScheduledTimer = {
  readonly handle: TimerHandle | null;
  readonly reference: TimerReference;
};

export type NavigationControllerOptions = {
  /**
   The TUI turns this off so dwell timers can be fired by hand.
   */
  readonly autoTimers?: boolean;
};

export class NavigationController<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> extends TypedEventTarget<NavigationEventProtocol<Node, Leaf, Menu>> {
  readonly #autoTimers: boolean;
  readonly #environment: MachineEnvironment<Node, Leaf, Menu>;
  readonly #inputQueue: NavigationInput[] = [];
  readonly #options: NavigationOptions;
  readonly #timers = new Map<number, ScheduledTimer>();
  #disposed = false;
  #processing = false;
  #state: NavigationState<Node, Menu>;

  constructor(
    environment: MachineEnvironment<Node, Leaf, Menu>,
    options: NavigationOptions,
    { autoTimers = true }: NavigationControllerOptions = {},
  ) {
    super(navigationEventTypes);
    this.#autoTimers = autoTimers;
    this.#environment = environment;
    this.#options = options;
    this.#state = initialNavigationState();
  }

  get pendingTimers(): readonly TimerReference[] {
    return [...this.#timers.values()].map(({ reference }) => reference);
  }

  get state(): NavigationState<Node, Menu> {
    return this.#state;
  }

  /**
   Serialize inputs. EventTarget dispatch is synchronous, so an event listener
   is allowed to call `send` without recursively transitioning half-updated
   state.
   */
  send(input: NavigationInput): void {
    if (this.#disposed) {
      throw new Error('Cannot send input to a disposed navigation controller.');
    }

    this.#inputQueue.push(input);
    if (this.#processing) {
      return;
    }

    this.#processing = true;
    try {
      let next = this.#inputQueue.shift();
      while (next) {
        if (next.type === 'timer.elapsed') {
          this.#clearTimer(next.detail.timer);
        }

        const result = transition(
          this.#state,
          next,
          this.#environment,
          this.#options,
        );
        this.#state = result.state;
        for (const effect of result.effects) {
          this.#interpret(effect);
        }

        next = this.#inputQueue.shift();
      }
    } finally {
      this.#processing = false;
    }
  }

  /**
   Manual clock hook used by the prototype. A production controller lets the
   runtime-created timeout send the same input.
   */
  elapse(timer: TimerReference, timeStamp = performance.now()): void {
    this.send({
      type: 'timer.elapsed',
      detail: { timer, timeStamp },
    });
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const { handle } of this.#timers.values()) {
      if (handle !== null) {
        globalThis.clearTimeout(handle);
      }
    }

    this.#timers.clear();
    this.#inputQueue.length = 0;
  }

  #clearTimer(reference: TimerReference): void {
    const scheduled = this.#timers.get(reference.token);
    if (!scheduled || scheduled.reference.kind !== reference.kind) {
      return;
    }

    if (scheduled.handle !== null) {
      globalThis.clearTimeout(scheduled.handle);
    }

    this.#timers.delete(reference.token);
  }

  #interpret(effect: MachineEffect<Node, Leaf, Menu>): void {
    switch (effect.type) {
      case 'emit': {
        this.emitMessage(effect.event);
        break;
      }

      case 'timer.cancel': {
        this.#clearTimer(effect.timer);
        break;
      }

      case 'timer.schedule': {
        const handle = this.#autoTimers
          ? globalThis.setTimeout(() => {
              this.elapse(effect.timer);
            }, effect.delay)
          : null;
        this.#timers.set(effect.timer.token, {
          handle,
          reference: effect.timer,
        });
        break;
      }
    }
  }
}
