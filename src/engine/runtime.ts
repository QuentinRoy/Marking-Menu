import mitt from 'mitt';
import type {
  MarkingMenuEventEmitter,
  MarkingMenuEventMap,
} from '../events.js';
import type { AnyModelNode } from '../types.js';
import { projectLayout } from './layout-view.js';
import {
  transition,
  type MachineCommand,
  type NavigationInput,
  type NavigationOptions,
  type NavigationState,
} from './machine.js';
import type { LayoutRenderer } from './renderer.js';

/** All an input source needs of the runtime: no events, no model. */
export type NavigationInputSink = {
  send: (input: NavigationInput) => void;
};

/**
 The runtime owns the emitter: interpreting the machine's `dispatch` commands
 is the only thing that ever originates an event.
 */
export type NavigationRuntime<M extends AnyModelNode> = NavigationInputSink &
  MarkingMenuEventEmitter<M> & {
    dispose: () => void;
  };

/**
 The runtime owns mutable infrastructure only: the committed state, the
 reentrant input queue, and command interpretation. It never makes domain
 decisions: those live in `transition`.
 */
export function createRuntime<M extends AnyModelNode>({
  model,
  options,
  renderer,
}: {
  model: M;
  options: NavigationOptions;
  renderer: LayoutRenderer;
}): NavigationRuntime<M> {
  const emitter = mitt<MarkingMenuEventMap<M>>();
  let state: NavigationState = { phase: 'idle' };
  let isDisposed = false;
  let isDraining = false;
  const pending: NavigationInput[] = [];

  // Two passes, not one: every visual effect lands before the first listener
  // runs, so a listener always observes fully committed state. See
  // `pointer-source.ts`'s `onPointerUp` for the same rule applied to capture.
  const runCommands = (commands: ReadonlyArray<MachineCommand<M>>) => {
    for (const command of commands) {
      if (command.type === 'feedback.show') {
        renderer.showFeedback({
          stroke: command.stroke,
          canceled: command.canceled,
        });
      }
    }

    renderer.render(projectLayout(state));

    for (const command of commands) {
      if (command.type === 'dispatch') {
        emitter.emit(command.event.type, command.event);
      }
    }
  };

  const send = (input: NavigationInput): void => {
    if (isDisposed) {
      throw new Error('Cannot send an input to a disposed controller.');
    }

    pending.push(input);
    if (isDraining) {
      return;
    }

    isDraining = true;
    try {
      // `isDisposed` is reassigned by `dispose()`, not by this loop body: a
      // listener dispatched from `runCommands` can call `dispose()`
      // reentrantly, and the loop must stop draining the rest of the batch
      // when that happens (disposal mid-batch drops the remainder).
      // eslint-disable-next-line no-unmodified-loop-condition
      while (!isDisposed) {
        const next = pending.shift();
        if (next === undefined) {
          break;
        }

        const result = transition(state, next, { model }, options);
        state = result.state;
        runCommands(result.commands);
      }
    } finally {
      isDraining = false;
      pending.length = 0;
    }
  };

  const dispose = (): void => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    renderer.dispose();
  };

  return { send, dispose, on: emitter.on, off: emitter.off };
}
