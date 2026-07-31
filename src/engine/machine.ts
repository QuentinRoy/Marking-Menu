import {
  MarkingMenuCancelEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type MarkingMenuEvent,
  type MarkingMenuMode,
} from '../events.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import type { AnyModelNode, ModelMenus } from '../types.js';
import { dist, type Point } from '../utils.js';

/*
 The pure navigation state machine: one entry point dispatching to a private
 handler per phase (idle/startup/expert/novice).
 */

/**
 The only timer kind a phase can own yet: startup/expert dwelling into novice.
 */
export type TimerKind = 'mode-dwell';

/**
 A timer's identity: monotonically increasing across the controller's
 lifetime (including returns to idle), so a `timer.elapsed` input can never be
 confused with a timer armed earlier for the same kind.
 */
export type TimerToken = number;

/** What a phase holding an armed timer needs to remember about it. */
export type TimerRef = {
  readonly kind: TimerKind;
  readonly token: TimerToken;
};

export type NavigationState<M extends AnyModelNode> =
  | { readonly phase: 'idle'; readonly nextTimerToken: TimerToken }
  | {
      readonly phase: 'startup';
      readonly origin: Point;
      readonly stroke: readonly Point[];
      readonly timer: TimerRef;
      readonly nextTimerToken: TimerToken;
    }
  | {
      readonly phase: 'expert';
      readonly stroke: readonly Point[];
      readonly nextTimerToken: TimerToken;
    }
  | {
      readonly phase: 'novice';
      readonly menu: ModelMenus<M>;
      readonly menuCenter: Point;
      readonly upperStroke: readonly Point[];
      readonly lowerStroke: readonly Point[];
      readonly nextTimerToken: TimerToken;
    };

export type NavigationInput =
  | { readonly type: 'pointer.down'; readonly position: Point }
  | { readonly type: 'pointer.move'; readonly position: Point }
  | { readonly type: 'pointer.up'; readonly position: Point }
  | { readonly type: 'pointer.cancel'; readonly position: Point }
  | {
      readonly type: 'timer.elapsed';
      readonly kind: TimerKind;
      readonly token: TimerToken;
    };

export type NavigationEnvironment<M extends AnyModelNode> = {
  readonly model: M;
};

export type NavigationOptions = {
  readonly movementsThreshold: number;
  readonly noviceDwellingTime: number;
};

export type MachineCommand<M extends AnyModelNode> =
  | { readonly type: 'dispatch'; readonly event: MarkingMenuEvent<M> }
  | {
      readonly type: 'feedback.show';
      readonly stroke: readonly Point[];
      readonly canceled: boolean;
    }
  | {
      readonly type: 'timer.schedule';
      readonly kind: TimerKind;
      readonly token: TimerToken;
      readonly delay: number;
    }
  | {
      readonly type: 'timer.cancel';
      readonly kind: TimerKind;
      readonly token: TimerToken;
    };

export type Transition<M extends AnyModelNode> = {
  readonly state: NavigationState<M>;
  readonly commands: ReadonlyArray<MachineCommand<M>>;
};

/**
 The shared terminal transition: recognize the gesture drawn so far (unless
 `skipRecognition`) and return to idle, either selecting the recognized item
 or cancelling. Owns the one place `select`/`cancel`/`feedback.show` are
 built so every phase doesn't repeat this policy, and the one place a
 phase's owned timer is cancelled before rendering and dispatching.

 `skipRecognition` covers the paths that must never select regardless of what
 the stroke looks like: a pointer that was cancelled outright, a gesture that
 never moved at all (so there is nothing to recognize), and novice mode, whose
 selection is proximity-based hit-testing rather than expert-style stroke
 recognition (not implemented yet, so novice always cancels).
 */
function finish<M extends AnyModelNode>(
  {
    mode,
    stroke,
    position,
    menu = null,
    skipRecognition = false,
    cancelTimer,
    nextTimerToken,
  }: {
    mode: MarkingMenuMode;
    stroke: readonly Point[];
    position: Point;
    menu?: ModelMenus<M> | null;
    skipRecognition?: boolean;
    cancelTimer?: TimerRef;
    nextTimerToken: TimerToken;
  },
  environment: NavigationEnvironment<M>,
): Transition<M> {
  const selection = skipRecognition
    ? null
    : recognizeMarkingMenuStroke(stroke, environment.model);
  const event =
    selection === null
      ? new MarkingMenuCancelEvent<M>({ mode, position, active: null, menu })
      : new MarkingMenuSelectEvent<M>({ mode, position, selection, menu });

  const timerCommands: Array<MachineCommand<M>> =
    cancelTimer === undefined ? [] : [{ type: 'timer.cancel', ...cancelTimer }];

  return {
    state: { phase: 'idle', nextTimerToken },
    commands: [
      ...timerCommands,
      { type: 'feedback.show', stroke, canceled: selection === null },
      { type: 'dispatch', event },
    ],
  };
}

function transitionStartup<M extends AnyModelNode>(
  state: Extract<NavigationState<M>, { phase: 'startup' }>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
  options: NavigationOptions,
): Transition<M> {
  switch (input.type) {
    case 'pointer.move': {
      const stroke = [...state.stroke, input.position];
      if (dist(state.origin, input.position) >= options.movementsThreshold) {
        // Significant movement wins the startup race outright: cancel the
        // mode-dwell timer so it can never fire novice mode open afterwards.
        return {
          state: {
            phase: 'expert',
            stroke,
            nextTimerToken: state.nextTimerToken,
          },
          commands: [{ type: 'timer.cancel', ...state.timer }],
        };
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
          cancelTimer: state.timer,
          nextTimerToken: state.nextTimerToken,
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
          cancelTimer: state.timer,
          nextTimerToken: state.nextTimerToken,
        },
        environment,
      );
    }

    case 'pointer.down': {
      return { state, commands: [] };
    }

    case 'timer.elapsed': {
      if (
        input.kind !== state.timer.kind ||
        input.token !== state.timer.token
      ) {
        // Superseded: this timer was already replaced or cancelled. A total
        // function, not an exception, per objective 10.
        return { state, commands: [] };
      }

      // The dwell wins the startup race: open novice mode at the root menu,
      // centered on the gesture's origin. The pointer is still well within
      // `movementsThreshold` of it, so nothing is active yet.
      //
      // The cast is safe: the root is always a menu, never a leaf. `M`'s
      // `isLeaf` is an unresolved `boolean` here, so `ModelMenus<M>` cannot
      // express that generically.
      const menu = environment.model as unknown as ModelMenus<M>;
      const menuCenter = state.origin;
      // `timer.elapsed` carries no position of its own; the machine holds
      // the last committed one instead. `state.stroke` always starts with
      // the origin and is only ever appended to, so it is never empty; the
      // cast avoids a disallowed non-null assertion for a case that cannot
      // happen.
      const position = state.stroke.at(-1) as Point;

      return {
        state: {
          phase: 'novice',
          menu,
          menuCenter,
          upperStroke: [menuCenter],
          lowerStroke: state.stroke,
          nextTimerToken: state.nextTimerToken,
        },
        commands: [
          {
            type: 'dispatch',
            event: new MarkingMenuOpenEvent<M>({ position, menu, menuCenter }),
          },
        ],
      };
    }
  }
}

function transitionExpert<M extends AnyModelNode>(
  state: Extract<NavigationState<M>, { phase: 'expert' }>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
): Transition<M> {
  switch (input.type) {
    case 'pointer.move': {
      return {
        state: {
          phase: 'expert',
          stroke: [...state.stroke, input.position],
          nextTimerToken: state.nextTimerToken,
        },
        commands: [],
      };
    }

    case 'pointer.up': {
      return finish(
        {
          mode: 'expert',
          stroke: [...state.stroke, input.position],
          position: input.position,
          nextTimerToken: state.nextTimerToken,
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
          nextTimerToken: state.nextTimerToken,
        },
        environment,
      );
    }

    case 'pointer.down': {
      return { state, commands: [] };
    }

    case 'timer.elapsed': {
      // Expert owns no timer yet: any that arrives here is stale.
      return { state, commands: [] };
    }
  }
}

function transitionNovice<M extends AnyModelNode>(
  state: Extract<NavigationState<M>, { phase: 'novice' }>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
): Transition<M> {
  switch (input.type) {
    case 'pointer.down':
    case 'timer.elapsed': {
      // No sub-menu timer yet, and a second concurrent gesture is rejected
      // upstream: both are no-ops here.
      return { state, commands: [] };
    }

    case 'pointer.move': {
      // Hit-testing the menu is not implemented yet: movement inside novice
      // mode has no ticket driving it into existence.
      return { state, commands: [] };
    }

    case 'pointer.up':
    case 'pointer.cancel': {
      return finish(
        {
          mode: 'novice',
          stroke: [...state.lowerStroke, ...state.upperStroke, input.position],
          position: input.position,
          menu: state.menu,
          // Novice selection is proximity-based hit-testing, not expert-style
          // stroke recognition, and hit-testing isn't implemented yet: every
          // release cancels for now.
          skipRecognition: true,
          nextTimerToken: state.nextTimerToken,
        },
        environment,
      );
    }
  }
}

function transitionIdle<M extends AnyModelNode>(
  state: Extract<NavigationState<M>, { phase: 'idle' }>,
  input: NavigationInput,
  options: NavigationOptions,
): Transition<M> {
  if (input.type === 'pointer.down') {
    const token = state.nextTimerToken;
    return {
      state: {
        phase: 'startup',
        origin: input.position,
        stroke: [input.position],
        timer: { kind: 'mode-dwell', token },
        nextTimerToken: token + 1,
      },
      commands: [
        {
          type: 'dispatch',
          event: new MarkingMenuStartEvent({ position: input.position }),
        },
        {
          type: 'timer.schedule',
          kind: 'mode-dwell',
          token,
          delay: options.noviceDwellingTime,
        },
      ],
    };
  }

  return { state, commands: [] };
}

/**
 The machine's single entry point: dispatches to one private handler per
 phase. Pure: no DOM, no timers, no side effects — arming and cancelling a
 timer is a command the runtime interprets, not something this function does.
 */
export function transition<M extends AnyModelNode>(
  state: NavigationState<M>,
  input: NavigationInput,
  environment: NavigationEnvironment<M>,
  options: NavigationOptions,
): Transition<M> {
  switch (state.phase) {
    case 'idle': {
      return transitionIdle(state, input, options);
    }

    case 'startup': {
      return transitionStartup(state, input, environment, options);
    }

    case 'expert': {
      return transitionExpert(state, input, environment);
    }

    case 'novice': {
      return transitionNovice(state, input, environment);
    }
  }
}
