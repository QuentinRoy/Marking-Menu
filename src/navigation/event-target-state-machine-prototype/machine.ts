/**
 PROTOTYPE: a pure, explicit replacement for the navigation Observable
 graph. There is no DOM, timer, layout, or event dispatch in this module.
 */

import type { ProtocolMessage } from './typed-event-target.ts';

export type Point = readonly [x: number, y: number];

export type MenuNode = {
  readonly isLeaf: boolean;
  readonly isRoot: boolean;
};

export type TimerKind = 'mode-dwell' | 'submenu-dwell';

export type TimerReference = {
  readonly kind: TimerKind;
  readonly token: number;
};

export type PointerSample = {
  readonly position: Point;
  readonly timeStamp: number;
};

export type NavigationInput =
  | { readonly type: 'pointer.down'; readonly detail: PointerSample }
  | { readonly type: 'pointer.move'; readonly detail: PointerSample }
  | { readonly type: 'pointer.up'; readonly detail: PointerSample }
  | { readonly type: 'pointer.cancel'; readonly detail: PointerSample }
  | {
      readonly type: 'timer.elapsed';
      readonly detail: {
        readonly timeStamp: number;
        readonly timer: TimerReference;
      };
    };

export type NavigationEventProtocol<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> = {
  start: {
    readonly mode: 'startup';
    readonly position: Point;
    readonly timeStamp: number;
  };
  draw: {
    readonly mode: 'expert' | 'startup';
    readonly position: Point;
    readonly stroke: readonly Point[];
    readonly timeStamp: number;
  };
  open: {
    readonly menu: Menu;
    readonly menuCenter: Point;
    readonly mode: 'novice';
    readonly position: Point;
    readonly timeStamp: number;
  };
  change: {
    readonly active: Node | null;
    readonly mode: 'novice';
    readonly position: Point;
    readonly timeStamp: number;
  };
  move: {
    readonly active: Node | null;
    readonly mode: 'novice';
    readonly position: Point;
    readonly timeStamp: number;
  };
  select: {
    readonly mode: 'expert' | 'novice' | 'startup';
    readonly position: Point;
    readonly selection: Leaf;
    readonly timeStamp: number;
  };
  cancel: {
    readonly mode: 'expert' | 'novice' | 'startup';
    readonly position: Point;
    readonly timeStamp: number;
  };
};

export type NavigationOutput<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> = ProtocolMessage<NavigationEventProtocol<Node, Leaf, Menu>>;

type Gesture = {
  readonly lastSignificantPosition: Point;
  readonly origin: Point;
  readonly position: Point;
  readonly stroke: readonly Point[];
};

type IdlePhase = {
  readonly status: 'idle';
};

type StartupPhase = {
  readonly gesture: Gesture;
  readonly modeTimer: TimerReference;
  readonly status: 'startup';
};

type ExpertPhase = {
  readonly gesture: Gesture;
  readonly modeTimer: TimerReference;
  readonly status: 'expert';
};

type NovicePhase<Node extends MenuNode, Menu extends Node> = {
  readonly active: Node | null;
  readonly gesture: Gesture;
  readonly menu: Menu;
  readonly menuCenter: Point;
  readonly menuPath: readonly Menu[];
  readonly radius: number;
  readonly status: 'novice';
  readonly submenuTimer: TimerReference | null;
};

export type NavigationPhase<Node extends MenuNode, Menu extends Node> =
  IdlePhase | StartupPhase | ExpertPhase | NovicePhase<Node, Menu>;

export type NavigationState<Node extends MenuNode, Menu extends Node> = {
  readonly nextTimerToken: number;
  readonly phase: NavigationPhase<Node, Menu>;
};

export type NavigationOptions = {
  readonly minMenuSelectionDist: number;
  readonly minSelectionDist: number;
  readonly movementsThreshold: number;
  readonly noviceDwellingTime: number;
  readonly submenuOpeningDelay: number;
};

export type MachineEnvironment<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> = {
  readonly hitTest: (
    menu: Menu,
    menuCenter: Point,
    position: Point,
    minSelectionDist: number,
  ) => { readonly active: Node | null; readonly radius: number };
  readonly isLeaf: (node: Node) => node is Leaf;
  readonly isMenu: (node: Node) => node is Menu;
  readonly recognizeLeaf: (stroke: readonly Point[]) => Leaf | null;
  readonly recognizeMenu: (stroke: readonly Point[]) => Menu | null;
  readonly root: Menu;
};

export type MachineEffect<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> =
  | {
      readonly type: 'emit';
      readonly event: NavigationOutput<Node, Leaf, Menu>;
    }
  | {
      readonly type: 'timer.schedule';
      readonly delay: number;
      readonly timer: TimerReference;
    }
  | {
      readonly type: 'timer.cancel';
      readonly timer: TimerReference;
    };

export type Transition<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
> = {
  readonly effects: ReadonlyArray<MachineEffect<Node, Leaf, Menu>>;
  readonly state: NavigationState<Node, Menu>;
};

export const initialNavigationState = <
  Node extends MenuNode,
  Menu extends Node,
>(): NavigationState<Node, Menu> => ({
  nextTimerToken: 0,
  phase: { status: 'idle' },
});

const distance = (first: Point, second: Point): number =>
  Math.hypot(second[0] - first[0], second[1] - first[1]);

const withSample = (gesture: Gesture, sample: PointerSample): Gesture => ({
  ...gesture,
  position: sample.position,
  stroke: [...gesture.stroke, sample.position],
});

const withSignificantSample = (
  gesture: Gesture,
  sample: PointerSample,
): Gesture => ({
  ...withSample(gesture, sample),
  lastSignificantPosition: sample.position,
});

const isSignificant = (
  gesture: Gesture,
  position: Point,
  threshold: number,
): boolean => distance(gesture.lastSignificantPosition, position) >= threshold;

const timer = (kind: TimerKind, token: number): TimerReference => ({
  kind,
  token,
});

const timerMatches = (
  expected: TimerReference | null,
  received: TimerReference,
): boolean =>
  expected !== null &&
  expected.kind === received.kind &&
  expected.token === received.token;

const emit = <Node extends MenuNode, Leaf extends Node, Menu extends Node>(
  event: NavigationOutput<Node, Leaf, Menu>,
): MachineEffect<Node, Leaf, Menu> => ({ type: 'emit', event });

const cancelTimer = <
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
>(
  timer_: TimerReference,
): MachineEffect<Node, Leaf, Menu> => ({
  type: 'timer.cancel',
  timer: timer_,
});

const scheduleTimer = <
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
>(
  timer_: TimerReference,
  delay: number,
): MachineEffect<Node, Leaf, Menu> => ({
  type: 'timer.schedule',
  delay,
  timer: timer_,
});

const unchanged = <Node extends MenuNode, Leaf extends Node, Menu extends Node>(
  state: NavigationState<Node, Menu>,
): Transition<Node, Leaf, Menu> => ({ effects: [], state });

/**
 Move from any active mode back to idle after a terminal notification.
 */
const finish = <Node extends MenuNode, Leaf extends Node, Menu extends Node>(
  state: NavigationState<Node, Menu>,
  effects: ReadonlyArray<MachineEffect<Node, Leaf, Menu>>,
): Transition<Node, Leaf, Menu> => ({
  effects,
  state: {
    nextTimerToken: state.nextTimerToken,
    phase: { status: 'idle' },
  },
});

const sampleStartupOrExpert = <
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
>(
  state: NavigationState<Node, Menu>,
  phase: StartupPhase | ExpertPhase,
  sample: PointerSample,
  options: NavigationOptions,
  rescheduleTimer: boolean,
): Transition<Node, Leaf, Menu> => {
  const significant = isSignificant(
    phase.gesture,
    sample.position,
    options.movementsThreshold,
  );
  const gesture = significant
    ? withSignificantSample(phase.gesture, sample)
    : withSample(phase.gesture, sample);
  const nextStatus =
    phase.status === 'startup' && significant ? 'expert' : phase.status;
  const drawMode = phase.status;
  const effects: Array<MachineEffect<Node, Leaf, Menu>> = [
    emit({
      type: 'draw',
      detail: {
        mode: drawMode,
        position: sample.position,
        stroke: gesture.stroke,
        timeStamp: sample.timeStamp,
      },
    }),
  ];
  let { modeTimer } = phase;
  let { nextTimerToken } = state;

  if (significant && rescheduleTimer) {
    modeTimer = timer('mode-dwell', nextTimerToken);
    nextTimerToken += 1;
    effects.push(
      cancelTimer(phase.modeTimer),
      scheduleTimer(modeTimer, options.noviceDwellingTime),
    );
  }

  return {
    effects,
    state: {
      nextTimerToken,
      phase: {
        gesture,
        modeTimer,
        status: nextStatus,
      },
    },
  };
};

const sampleNovice = <
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
>(
  state: NavigationState<Node, Menu>,
  phase: NovicePhase<Node, Menu>,
  sample: PointerSample,
  environment: MachineEnvironment<Node, Leaf, Menu>,
  options: NavigationOptions,
  rescheduleTimer: boolean,
): Transition<Node, Leaf, Menu> => {
  const significant = isSignificant(
    phase.gesture,
    sample.position,
    options.movementsThreshold,
  );
  const gesture = significant
    ? withSignificantSample(phase.gesture, sample)
    : withSample(phase.gesture, sample);
  const { active, radius } = environment.hitTest(
    phase.menu,
    phase.menuCenter,
    sample.position,
    options.minSelectionDist,
  );
  const effects: Array<MachineEffect<Node, Leaf, Menu>> = [
    emit({
      type: active === phase.active ? 'move' : 'change',
      detail: {
        active,
        mode: 'novice',
        position: sample.position,
        timeStamp: sample.timeStamp,
      },
    }),
  ];
  let { submenuTimer } = phase;
  let { nextTimerToken } = state;

  if (significant && rescheduleTimer) {
    if (submenuTimer) {
      effects.push(cancelTimer(submenuTimer));
    }

    submenuTimer = timer('submenu-dwell', nextTimerToken);
    nextTimerToken += 1;
    effects.push(scheduleTimer(submenuTimer, options.submenuOpeningDelay));
  }

  return {
    effects,
    state: {
      nextTimerToken,
      phase: {
        ...phase,
        active,
        gesture,
        radius,
        submenuTimer,
      },
    },
  };
};

export function transition<
  Node extends MenuNode,
  Leaf extends Node,
  Menu extends Node,
>(
  state: NavigationState<Node, Menu>,
  input: NavigationInput,
  environment: MachineEnvironment<Node, Leaf, Menu>,
  options: NavigationOptions,
): Transition<Node, Leaf, Menu> {
  const { phase } = state;

  if (phase.status === 'idle') {
    if (input.type !== 'pointer.down') {
      return unchanged<Node, Leaf, Menu>(state);
    }

    const modeTimer = timer('mode-dwell', state.nextTimerToken);
    const { position, timeStamp } = input.detail;
    return {
      effects: [
        emit({
          type: 'start',
          detail: { mode: 'startup', position, timeStamp },
        }),
        scheduleTimer(modeTimer, options.noviceDwellingTime),
      ],
      state: {
        nextTimerToken: state.nextTimerToken + 1,
        phase: {
          gesture: {
            lastSignificantPosition: position,
            origin: position,
            position,
            stroke: [position],
          },
          modeTimer,
          status: 'startup',
        },
      },
    };
  }

  if (input.type === 'pointer.down') {
    // A pointer source owns the "one active primary gesture" guard. Ignoring a
    // second down here keeps that source policy out of the state model.
    return unchanged<Node, Leaf, Menu>(state);
  }

  if (input.type === 'pointer.cancel') {
    const activeTimer =
      phase.status === 'novice' ? phase.submenuTimer : phase.modeTimer;
    const effects: Array<MachineEffect<Node, Leaf, Menu>> = [];
    if (activeTimer) {
      effects.push(cancelTimer<Node, Leaf, Menu>(activeTimer));
    }

    effects.push(
      emit<Node, Leaf, Menu>({
        type: 'cancel',
        detail: {
          mode: phase.status,
          position: input.detail.position,
          timeStamp: input.detail.timeStamp,
        },
      }),
    );
    return finish<Node, Leaf, Menu>(state, effects);
  }

  if (input.type === 'pointer.move') {
    if (phase.status === 'novice') {
      return sampleNovice<Node, Leaf, Menu>(
        state,
        phase,
        input.detail,
        environment,
        options,
        true,
      );
    }

    return sampleStartupOrExpert<Node, Leaf, Menu>(
      state,
      phase,
      input.detail,
      options,
      true,
    );
  }

  if (input.type === 'pointer.up') {
    const sampled =
      phase.status === 'novice'
        ? sampleNovice<Node, Leaf, Menu>(
            state,
            phase,
            input.detail,
            environment,
            options,
            false,
          )
        : sampleStartupOrExpert<Node, Leaf, Menu>(
            state,
            phase,
            input.detail,
            options,
            false,
          );
    const sampledPhase = sampled.state.phase;

    if (sampledPhase.status === 'idle') {
      return sampled;
    }

    const activeTimer =
      sampledPhase.status === 'novice'
        ? sampledPhase.submenuTimer
        : sampledPhase.modeTimer;
    const effects: Array<MachineEffect<Node, Leaf, Menu>> = [
      ...sampled.effects,
    ];
    if (activeTimer) {
      effects.push(cancelTimer<Node, Leaf, Menu>(activeTimer));
    }

    if (sampledPhase.status === 'novice') {
      if (sampledPhase.active && environment.isLeaf(sampledPhase.active)) {
        effects.push(
          emit({
            type: 'select',
            detail: {
              mode: 'novice',
              position: input.detail.position,
              selection: sampledPhase.active,
              timeStamp: input.detail.timeStamp,
            },
          }),
        );
      } else {
        effects.push(
          emit({
            type: 'cancel',
            detail: {
              mode: 'novice',
              position: input.detail.position,
              timeStamp: input.detail.timeStamp,
            },
          }),
        );
      }
    } else {
      const selection = environment.recognizeLeaf(sampledPhase.gesture.stroke);
      effects.push(
        selection
          ? emit({
              type: 'select',
              detail: {
                mode: sampledPhase.status,
                position: input.detail.position,
                selection,
                timeStamp: input.detail.timeStamp,
              },
            })
          : emit({
              type: 'cancel',
              detail: {
                mode: sampledPhase.status,
                position: input.detail.position,
                timeStamp: input.detail.timeStamp,
              },
            }),
      );
    }

    return finish<Node, Leaf, Menu>(sampled.state, effects);
  }

  if (phase.status === 'startup') {
    if (!timerMatches(phase.modeTimer, input.detail.timer)) {
      return unchanged<Node, Leaf, Menu>(state);
    }

    const submenuTimer = timer('submenu-dwell', state.nextTimerToken);
    return {
      effects: [
        emit({
          type: 'open',
          detail: {
            menu: environment.root,
            menuCenter: phase.gesture.origin,
            mode: 'novice',
            position: phase.gesture.position,
            timeStamp: input.detail.timeStamp,
          },
        }),
        scheduleTimer(submenuTimer, options.submenuOpeningDelay),
      ],
      state: {
        nextTimerToken: state.nextTimerToken + 1,
        phase: {
          active: null,
          gesture: phase.gesture,
          menu: environment.root,
          menuCenter: phase.gesture.origin,
          menuPath: [environment.root],
          radius: 0,
          status: 'novice',
          submenuTimer,
        },
      },
    };
  }

  if (phase.status === 'expert') {
    if (!timerMatches(phase.modeTimer, input.detail.timer)) {
      return unchanged<Node, Leaf, Menu>(state);
    }

    const menu = environment.recognizeMenu(phase.gesture.stroke);
    if (!menu || menu.isRoot) {
      return finish<Node, Leaf, Menu>(state, [
        emit({
          type: 'cancel',
          detail: {
            mode: 'expert',
            position: phase.gesture.position,
            timeStamp: input.detail.timeStamp,
          },
        }),
      ]);
    }

    const submenuTimer = timer('submenu-dwell', state.nextTimerToken);
    return {
      effects: [
        emit({
          type: 'open',
          detail: {
            menu,
            menuCenter: phase.gesture.position,
            mode: 'novice',
            position: phase.gesture.position,
            timeStamp: input.detail.timeStamp,
          },
        }),
        scheduleTimer(submenuTimer, options.submenuOpeningDelay),
      ],
      state: {
        nextTimerToken: state.nextTimerToken + 1,
        phase: {
          active: null,
          gesture: phase.gesture,
          menu,
          menuCenter: phase.gesture.position,
          menuPath: [environment.root, menu],
          radius: 0,
          status: 'novice',
          submenuTimer,
        },
      },
    };
  }

  if (!timerMatches(phase.submenuTimer, input.detail.timer)) {
    return unchanged<Node, Leaf, Menu>(state);
  }

  if (
    !phase.active ||
    !environment.isMenu(phase.active) ||
    phase.radius <= options.minMenuSelectionDist
  ) {
    return {
      effects: [],
      state: {
        ...state,
        phase: { ...phase, submenuTimer: null },
      },
    };
  }

  const submenuTimer = timer('submenu-dwell', state.nextTimerToken);
  return {
    effects: [
      emit({
        type: 'open',
        detail: {
          menu: phase.active,
          menuCenter: phase.gesture.position,
          mode: 'novice',
          position: phase.gesture.position,
          timeStamp: input.detail.timeStamp,
        },
      }),
      scheduleTimer(submenuTimer, options.submenuOpeningDelay),
    ],
    state: {
      nextTimerToken: state.nextTimerToken + 1,
      phase: {
        ...phase,
        active: null,
        menu: phase.active,
        menuCenter: phase.gesture.position,
        menuPath: [...phase.menuPath, phase.active],
        radius: 0,
        submenuTimer,
      },
    },
  };
}
