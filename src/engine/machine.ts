import {
  MarkingMenuCancelEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type MarkingMenuEvent,
  type MarkingMenuMode,
} from '../events.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import type { AnyModelNode } from '../types.js';
import { dist, type Point } from '../utils.js';

/*
 The pure navigation state machine: one entry point dispatching to a private
 handler per phase (idle/startup/expert), per the architecture settled on
 https://github.com/QuentinRoy/Marking-Menu/issues/153. `novice` is not a
 phase yet: no ticket has driven it into existence.
 */

export type NavigationState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'startup';
      readonly origin: Point;
      readonly stroke: readonly Point[];
    }
  | { readonly phase: 'expert'; readonly stroke: readonly Point[] };

export type NavigationInput =
  | { readonly type: 'pointer.down'; readonly position: Point }
  | { readonly type: 'pointer.move'; readonly position: Point }
  | { readonly type: 'pointer.up'; readonly position: Point }
  | { readonly type: 'pointer.cancel'; readonly position: Point };

export type NavigationEnvironment<M extends AnyModelNode> = {
  readonly model: M;
};

export type NavigationOptions = {
  readonly movementsThreshold: number;
};

export type MachineCommand<M extends AnyModelNode> =
  | { readonly type: 'dispatch'; readonly event: MarkingMenuEvent<M> }
  | {
      readonly type: 'feedback.show';
      readonly stroke: readonly Point[];
      readonly canceled: boolean;
    };

export type Transition<M extends AnyModelNode> = {
  readonly state: NavigationState;
  readonly commands: ReadonlyArray<MachineCommand<M>>;
};

/**
 The shared terminal transition: recognize the gesture drawn so far (unless
 `skipRecognition`) and return to idle, either selecting the recognized item
 or cancelling. Owns the one place `select`/`cancel`/`feedback.show` are
 built so `startup` and `expert` don't each repeat this policy.

 `skipRecognition` covers the two paths that must never select regardless of
 what the stroke looks like: a pointer that was cancelled outright, and a
 gesture that never moved at all (so there is nothing to recognize).
 */
function finish<M extends AnyModelNode>(
  {
    mode,
    stroke,
    position,
    skipRecognition = false,
  }: {
    mode: MarkingMenuMode;
    stroke: readonly Point[];
    position: Point;
    skipRecognition?: boolean;
  },
  environment: NavigationEnvironment<M>,
): Transition<M> {
  const selection = skipRecognition
    ? null
    : recognizeMarkingMenuStroke(stroke, environment.model);

  if (selection !== null) {
    return {
      state: { phase: 'idle' },
      commands: [
        { type: 'feedback.show', stroke, canceled: false },
        {
          type: 'dispatch',
          event: new MarkingMenuSelectEvent<M>({
            mode,
            position,
            selection,
            menu: null,
          }),
        },
      ],
    };
  }

  return {
    state: { phase: 'idle' },
    commands: [
      { type: 'feedback.show', stroke, canceled: true },
      {
        type: 'dispatch',
        event: new MarkingMenuCancelEvent<M>({
          mode,
          position,
          active: null,
          menu: null,
        }),
      },
    ],
  };
}

function transitionStartup<M extends AnyModelNode>(
  state: Extract<NavigationState, { phase: 'startup' }>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
  options: NavigationOptions,
): Transition<M> {
  switch (input.type) {
    case 'pointer.move': {
      const stroke = [...state.stroke, input.position];
      if (dist(state.origin, input.position) >= options.movementsThreshold) {
        return { state: { phase: 'expert', stroke }, commands: [] };
      }

      return { state: { ...state, stroke }, commands: [] };
    }

    case 'pointer.up': {
      const stroke = [...state.stroke, input.position];
      return finish(
        {
          mode: 'startup',
          stroke,
          position: input.position,
          // The pointer never moved at all: every recorded point (down,
          // any moves below the threshold, and this up) sits at the same
          // position, so there is nothing to recognize.
          skipRecognition: strokeLength(stroke) === 0,
        },
        environment,
      );
    }

    case 'pointer.cancel': {
      return finish(
        {
          mode: 'startup',
          stroke: [...state.stroke, input.position],
          position: input.position,
          skipRecognition: true,
        },
        environment,
      );
    }

    case 'pointer.down': {
      return { state, commands: [] };
    }
  }
}

function transitionExpert<M extends AnyModelNode>(
  state: Extract<NavigationState, { phase: 'expert' }>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
): Transition<M> {
  switch (input.type) {
    case 'pointer.move': {
      return {
        state: { phase: 'expert', stroke: [...state.stroke, input.position] },
        commands: [],
      };
    }

    case 'pointer.up': {
      return finish(
        {
          mode: 'expert',
          stroke: [...state.stroke, input.position],
          position: input.position,
        },
        environment,
      );
    }

    case 'pointer.cancel': {
      return finish(
        {
          mode: 'expert',
          stroke: [...state.stroke, input.position],
          position: input.position,
          skipRecognition: true,
        },
        environment,
      );
    }

    case 'pointer.down': {
      return { state, commands: [] };
    }
  }
}

function transitionIdle<M extends AnyModelNode>(
  input: NavigationInput,
): Transition<M> {
  if (input.type === 'pointer.down') {
    return {
      state: {
        phase: 'startup',
        origin: input.position,
        stroke: [input.position],
      },
      commands: [
        {
          type: 'dispatch',
          event: new MarkingMenuStartEvent({ position: input.position }),
        },
      ],
    };
  }

  return { state: { phase: 'idle' }, commands: [] };
}

/**
 The machine's single entry point: dispatches to one private handler per
 phase. Pure: no DOM, no timers.
 */
export function transition<M extends AnyModelNode>(
  state: NavigationState,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
  options: NavigationOptions,
): Transition<M> {
  switch (state.phase) {
    case 'idle': {
      return transitionIdle(input);
    }

    case 'startup': {
      return transitionStartup(state, input, environment, options);
    }

    case 'expert': {
      return transitionExpert(state, input, environment);
    }
  }
}
