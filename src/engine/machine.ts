import { machine, type, type Skip } from 'totorobot';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type MarkingMenuMode,
  type MarkingMenuRecognition,
} from '../events.js';
import {
  recognizeStroke,
  type StrokeCut,
} from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import type { ModelItem, ModelLeaf, ModelMenu, ModelNode } from '../types.js';
import { dist, last, toPolar, type Point } from '../utils.js';
import {
  currentMenu,
  noviceUpperStroke,
  projectLayout,
  type LayoutView,
} from './layout-view.js';
import type {
  EngineModelItem,
  EngineModelMenu,
  EngineModelRoot,
} from './model-node.js';

/*
 The navigation machine, declared as a totorobot definition rather than a
 hand-rolled reducer. `machine()` is inert data; `runtime.ts` is the only
 place that ever calls `.start()` on it.

 A definition is a single, non-generic value, so it uses the recursive
 `EngineModel*` types. They retain the renderer's required fields while
 `runtime.ts` keeps the caller's exact model type for public events.
 */

export type NavigationOptions = {
  readonly movementsThreshold: number;
  readonly noviceDwellingTime: number;
  readonly deadZoneRadius: number;
  readonly submenuOpeningDelay: number;
};

type MachineInputs = {
  down: { readonly position: Point };
  move: { readonly position: Point };
  up: { readonly position: Point };
  cancel: { readonly position: Point };
  dwell: undefined;
  dispose: undefined;
  // Standalone: a menu displayed without a pointer gesture.
  open: { readonly position: Point };
  close: undefined;
  // The keyboard intents, moving through the displayed levels and items.
  next: undefined;
  previous: undefined;
  first: undefined;
  last: undefined;
  activate: undefined;
  enter: undefined;
  leave: undefined;
  escape: undefined;
  exit: undefined;
  // The platform moved focus onto the item with this key.
  focus: { readonly key: string };
};

type PointerInputName = 'down' | 'move' | 'up' | 'cancel';

/**
 What the keyboard asks of a standalone menu, once its keys are translated:
 `next` and `previous` walk the items clockwise, `first` and `last`
 jump to the ends, `activate` selects a leaf or enters a submenu, `enter` and
 `leave` go down and up a level, `escape` goes up a level or cancels, and
 `exit` cancels from any level.
 */
export type KeyboardIntent =
  | 'next'
  | 'previous'
  | 'first'
  | 'last'
  | 'activate'
  | 'enter'
  | 'leave'
  | 'escape'
  | 'exit';

/**
 The boundary input shape `pointer-source.ts` sends: unrelated to the
 machine's own (shorter) input vocabulary, so that layer never has to know
 about it. Derived from `MachineInputs`' pointer keys with a `pointer.`
 prefix, so the two can't drift apart.
 */
export type NavigationInput =
  | {
      [K in PointerInputName]: {
        readonly type: `pointer.${K}`;
      } & MachineInputs[K];
    }[PointerInputName]
  | { readonly type: 'keyboard'; readonly intent: KeyboardIntent }
  | { readonly type: 'focus'; readonly key: string };

/**
 Each phase's fields, factored out before `NavigationState` tags on a
 `phase` discriminant or `MachineStates` adds `model`/`options`: the one
 place either lists them, so the two can't diverge. Parameterized over the
 menu/active node types so the public projection and the machine's erased
 projection share one phase definition.
 */
type NavigationPhaseFields<Menu, Active> = {
  idle: Record<never, never>;
  startup: {
    readonly origin: Point;
    readonly stroke: readonly Point[];
    // When the pending novice-dwell timer was armed. Startup's own residency
    // never restarts, so this is set once, on arrival.
    readonly dwellStartedAt: number;
  };
  expert: {
    readonly stroke: readonly Point[];
    // The last position significant movement was measured from, feeding the
    // `movementsThreshold` check below.
    readonly dwellAnchor: Point;
    // When the pending novice-dwell timer was last armed: bumped alongside
    // `dwellAnchor` on significant movement, and what the residency's
    // `restart` predicate compares below.
    readonly dwellStartedAt: number;
  };
  // A menu displayed on its own: no gesture, no stroke, no timer. It walks
  // down and up the menu levels through the stack, always centered where it
  // opened, and only ever leaves through a selection or a cancel.
  standalone: {
    // The displayed levels, from the root to the current one.
    readonly menus: readonly Menu[];
    readonly menuCenter: Point;
    readonly active: Active | undefined;
  };
  // A step the machine only passes through: the expert dwell recognizes the
  // stroke here, once, and the
  // immediate rows below carry the result on to `novice` or `idle`. The
  // machine never rests in it, and it is never rendered.
  recognizing: {
    readonly stroke: readonly Point[];
    readonly analysis: StrokeCut;
    readonly menu: Menu | undefined;
  };
  novice: {
    readonly menu: Menu;
    readonly menuCenter: Point;
    readonly active: Active | undefined;
    // Where the pointer is now. The upper stroke novice mode draws is the
    // straight segment from `menuCenter` to here, so the machine keeps the
    // endpoint rather than the segment: `noviceUpperStroke` builds it for
    // the three places that need it.
    readonly lastPosition: Point;
    readonly lowerStroke: readonly Point[];
    // The last position significant movement was measured from: distinct
    // from `menuCenter`, which stays fixed for the life of this menu.
    readonly dwellAnchor: Point;
    // When the pending submenu-dwell timer was last armed: bumped on
    // significant movement, on opening a new menu, and when a dwell fires on
    // a leaf and is consumed without a phase change. Without that last case,
    // the residency's `restart` predicate below would see an unchanged value
    // and never re-arm. Also what the layout announces as the indicator's
    // `startedAt`.
    readonly dwellStartedAt: number;
  };
};

/**
 The boundary view of the machine's current phase: what `layout-view.ts`
 projects from. Kept as a plain discriminated union, independent of
 totorobot's own `{ name, data }` shape, so `projectLayout` needs no changes.
 */
export type NavigationState<Menu = ModelMenu, Active = ModelItem> = {
  [K in Exclude<keyof NavigationPhaseFields<Menu, Active>, 'recognizing'>]: {
    readonly phase: K;
  } & NavigationPhaseFields<Menu, Active>[K];
}[Exclude<keyof NavigationPhaseFields<Menu, Active>, 'recognizing'>];

/**
 What the machine can be observed doing. `recognizing` is listed for
 completeness only: the machine never rests there.
 */
export type NavigationPhase = keyof MachineStates;

type MachineStates = {
  [K in keyof NavigationPhaseFields<EngineModelMenu, EngineModelItem>]: {
    readonly model: EngineModelRoot;
    readonly options: NavigationOptions;
  } & NavigationPhaseFields<EngineModelMenu, EngineModelItem>[K];
};

/**
 The layout announcement's payload, carrying the menu projection the renderer
 consumes.
 */
export type NavigationLayoutAnnouncement = LayoutView<EngineModelMenu>;

export type NavigationFeedbackAnnouncement = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

type MachineOutputs = {
  start: MarkingMenuStartEvent;
  move: MarkingMenuMoveEvent;
  open: MarkingMenuOpenEvent;
  change: MarkingMenuChangeEvent;
  select: MarkingMenuSelectEvent;
  cancel: MarkingMenuCancelEvent;
  // Internal: consumed only by runtime.ts, never forwarded to a consumer.
  layout: NavigationLayoutAnnouncement;
  feedback: NavigationFeedbackAnnouncement;
};

/**
 Reassemble the boundary `NavigationState` from a committed `{ to, toData }`
 pair, for `projectLayout`.
 */
function toNavigationState(
  to: keyof MachineStates,
  toData: MachineStates[keyof MachineStates],
): NavigationState<EngineModelMenu, EngineModelItem> {
  return { phase: to, ...toData } as unknown as NavigationState<
    EngineModelMenu,
    EngineModelItem
  >;
}

/**
 Shared body of the three startup/expert move actions: no menu is open in
 either state, so `move` always carries an undefined `active` and `menu`
 there.
 */
function emitInactiveMove(
  emit: (name: 'move', data: MarkingMenuMoveEvent) => void,
  mode: 'startup' | 'expert',
  position: Point,
): void {
  emit(
    'move',
    new MarkingMenuMoveEvent<ModelNode>({
      mode,
      position,
      active: undefined,
      menu: undefined,
    }),
  );
}

/**
 A frozen copy of a point: the engine keeps its own, and a consumer that
 alters what an event publishes must not reach it.
 */
const copyPoint = (point: Point): Point =>
  Object.freeze([point[0], point[1]] as const);

/**
 Copy a recognition attempt into the frozen shape events publish. The
 recognizer's own analysis carries fields (each piece's length and angle) the
 public contract leaves out, and events must not leak them at run time.
 */
function toRecognition(
  stroke: readonly Point[],
  { articulationPoints, segments }: StrokeCut,
): MarkingMenuRecognition {
  const frozenSegments = segments.map((segment) => {
    const points = Object.freeze([
      copyPoint(segment.points[0]),
      copyPoint(segment.points[1]),
    ] as const);
    return Object.freeze({ points });
  });
  const analysis = Object.freeze({
    articulationPoints: Object.freeze(
      articulationPoints.map((point) => copyPoint(point)),
    ),
    segments: Object.freeze(frozenSegments),
  });
  return Object.freeze({
    stroke: Object.freeze(stroke.map((point) => copyPoint(point))),
    analysis,
  });
}

function isModelLeaf(item: ModelItem): item is ModelLeaf {
  return item.isLeaf;
}

function isModelMenuItem<Item extends ModelItem>(
  item: Item,
): item is Item & { readonly isLeaf: false } {
  return !item.isLeaf;
}

/**
 Shared body of the `startup` and `novice` dwell residencies: arm a `dwell`
 timer for `delayMs` and clear it on exit, whatever ends the residency,
 whether that is leaving the state or disposal.
 */
function armDwellTimer(
  delayMs: number,
  send: (input: 'dwell') => void,
): () => void {
  const timer = setTimeout(() => {
    send('dwell');
  }, delayMs);
  return () => {
    clearTimeout(timer);
  };
}

/**
 The context every termination action needs: the stroke drawn so far
 (including the release/cancel position), the menu open when it ended (if
 any), and the item that was active (if any). That active item is precisely
 the thing that is not selected once a termination action decides not to
 select it. Narrows structurally on `'lowerStroke' in fromData` rather than
 taking `from` as a parameter: `from` and `fromData` are only correlated
 inside totorobot's own transition record, and splitting them across two
 parameters here decorrelates them, so novice is picked out by the field
 only it has.
 */
function terminationContext(
  fromData: MachineStates['startup' | 'expert' | 'novice'],
  position: Point,
): {
  readonly stroke: readonly Point[];
  readonly menu: ModelMenu | undefined;
  readonly active: ModelItem | undefined;
} {
  if ('lowerStroke' in fromData) {
    const { lowerStroke, menu, active } = fromData;
    return {
      stroke: [...lowerStroke, ...noviceUpperStroke(fromData), position],
      menu,
      active,
    };
  }

  return {
    stroke: [...fromData.stroke, position],
    menu: undefined,
    active: undefined,
  };
}

/**
 Shared tail of every action that ends a gesture — `up`, `cancel`, and the
 expert dwell that finds nothing to switch to: announce `feedback`, then
 `select` or `cancel` depending on whether a selection was found. The
 latter two callers always pass an undefined `selection`, since neither ever
 attempts one.
 */
function emitTermination(
  emit: {
    (name: 'feedback', data: NavigationFeedbackAnnouncement): void;
    (name: 'cancel', data: MarkingMenuCancelEvent): void;
    (name: 'select', data: MarkingMenuSelectEvent): void;
  },
  {
    from,
    position,
    stroke,
    menu,
    active,
    selection,
    recognition,
  }: {
    readonly from: Exclude<MarkingMenuMode, 'standalone'>;
    readonly position: Point;
    readonly stroke: readonly Point[];
    readonly menu: ModelMenu | undefined;
    readonly active: ModelItem | undefined;
    readonly selection: ModelLeaf | undefined;
    // Present exactly when recognition ran for this termination.
    readonly recognition: MarkingMenuRecognition | undefined;
  },
): void {
  emit('feedback', { stroke, canceled: selection === undefined });
  if (selection === undefined) {
    emit(
      'cancel',
      new MarkingMenuCancelEvent<ModelNode>({
        mode: from,
        position,
        active,
        menu,
        recognition,
      }),
    );
  } else {
    emit(
      'select',
      new MarkingMenuSelectEvent({
        mode: from,
        position,
        selection,
        menu,
        recognition,
      }),
    );
  }
}

type StandaloneData = MachineStates['standalone'];

type StandaloneRow = (context: {
  readonly fromData: StandaloneData;
  readonly skip: () => Skip;
}) => StandaloneData | Skip;

/**
 A row moving the active item along the menu's items, which are listed
 clockwise. It declines when there is nowhere to go, so a menu with a single
 item announces no change.
 */
const moveActive =
  (step: 'next' | 'previous' | 'first' | 'last'): StandaloneRow =>
  ({ fromData, skip }) => {
    const { items } = currentMenu(fromData.menus);
    const index =
      fromData.active === undefined ? -1 : items.indexOf(fromData.active);
    let target: EngineModelItem | undefined;
    switch (step) {
      case 'next': {
        target = items[(index + 1) % items.length];
        break;
      }

      case 'previous': {
        // From nothing, or from the first item, back to the last one.
        target = items[(index <= 0 ? items.length : index) - 1];
        break;
      }

      case 'first': {
        target = items[0];
        break;
      }

      case 'last': {
        target = items.at(-1);
        break;
      }
    }

    return target === undefined || target === fromData.active
      ? skip()
      : { ...fromData, active: target };
  };

/**
 Go down into the active submenu, keeping the center, and land on its first
 item.
 */
const enterActive: StandaloneRow = ({ fromData, skip }) => {
  const { active } = fromData;
  if (active === undefined || !isModelMenuItem(active)) {
    return skip();
  }

  return {
    ...fromData,
    menus: [...fromData.menus, active],
    active: active.items[0],
  };
};

/**
 Go back up to the parent, landing on the item the level was entered from.
 */
const leaveLevel: StandaloneRow = ({ fromData, skip }) => {
  const left = currentMenu(fromData.menus);
  return fromData.menus.length < 2 || left.isRoot
    ? skip()
    : { ...fromData, menus: fromData.menus.slice(0, -1), active: left };
};

/**
 Announce a standalone menu level as displayed.
 */
function emitStandaloneOpen(
  emit: (name: 'open', data: MarkingMenuOpenEvent) => void,
  { menuCenter, menus }: Pick<StandaloneData, 'menuCenter' | 'menus'>,
): void {
  emit(
    'open',
    new MarkingMenuOpenEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: undefined,
      menu: currentMenu(menus),
      menuCenter,
    }),
  );
}

/**
 Announce that a standalone interaction ended without a selection.
 */
function cancelStandalone({
  fromData: { menus, active },
  emit,
}: {
  readonly fromData: StandaloneData;
  readonly emit: (name: 'cancel', data: MarkingMenuCancelEvent) => void;
}): void {
  emit(
    'cancel',
    new MarkingMenuCancelEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: undefined,
      active,
      menu: currentMenu(menus),
    }),
  );
}

type GestureState = 'startup' | 'expert' | 'novice';

/**
 What an action ending a gesture receives, whichever state it ends from.
 `from` and `fromData` are only correlated inside totorobot's own transition
 record, so `terminationContext` picks the state's own data out structurally.
 */
type GestureEndContext = {
  readonly from: GestureState;
  readonly fromData: MachineStates[GestureState];
  readonly inputData: { readonly position: Point };
  readonly emit: Parameters<typeof emitTermination>[0];
};

/**
 The shared termination policy of a released gesture: recognize the gesture
 drawn so far (unless skipped) and announce `select` or `cancel`.
 */
function releaseGesture({
  from,
  fromData,
  inputData,
  emit,
}: GestureEndContext): void {
  const { position } = inputData;
  const { stroke, menu, active } = terminationContext(fromData, position);

  // Novice release hit-tests the item already tracked as active rather than
  // running stroke recognition: only a leaf can be selected, and a non-leaf
  // (or absent) active item carries straight through to `cancel.active`
  // unchanged, since it is precisely the thing that was not selected. Startup
  // with zero movement has nothing to recognize; expert, and startup with
  // sub-threshold movement, always attempt it.
  let selection: ModelLeaf | undefined;
  let recognition: MarkingMenuRecognition | undefined;
  if (from === 'novice') {
    selection =
      active !== undefined && isModelLeaf(active) ? active : undefined;
  } else if (from === 'startup' && strokeLength(stroke) === 0) {
    selection = undefined;
  } else {
    const attempt = recognizeStroke(stroke, fromData.model, 'leaf');
    selection = attempt.outcome;
    recognition = toRecognition(stroke, attempt.analysis);
  }

  emitTermination(emit, {
    from,
    position,
    stroke,
    menu,
    active,
    selection,
    recognition,
  });
}

/**
 A pointer canceled outright never selects, regardless of what was active or
 what the stroke looks like: recognition never runs, and a novice active item,
 leaf or not, carries through to `cancel.active` unchanged.
 */
function cancelGesture({
  from,
  fromData,
  inputData,
  emit,
}: GestureEndContext): void {
  const { position } = inputData;
  const { stroke, menu, active } = terminationContext(fromData, position);

  emitTermination(emit, {
    from,
    position,
    stroke,
    menu,
    active,
    selection: undefined,
    recognition: undefined,
  });
}

/**
 The transition every gesture ends with, back to idle's own shape.
 */
const backToIdle = ({
  fromData: { model, options },
}: {
  readonly fromData: MachineStates[keyof MachineStates];
}): MachineStates['idle'] => ({ model, options });

export const navigationMachine = machine({
  inputs: type<MachineInputs>(),
  states: type<MachineStates>(),
  outputs: type<MachineOutputs>(),

  initial: 'idle',

  transitions: {
    'idle -down> startup': ({
      fromData: { model, options },
      inputData: { position },
    }) => ({
      model,
      options,
      origin: position,
      stroke: [position],
      dwellStartedAt: Date.now(),
    }),

    'startup -move> expert'({
      fromData: { model, options, origin, stroke },
      inputData: { position },
      skip,
    }) {
      const newStroke = [...stroke, position];
      return dist(origin, position) >= options.movementsThreshold
        ? {
            model,
            options,
            stroke: newStroke,
            dwellAnchor: position,
            dwellStartedAt: Date.now(),
          }
        : skip();
    },

    'startup -move> startup': ({ fromData, inputData }) => ({
      ...fromData,
      stroke: [...fromData.stroke, inputData.position],
    }),

    // The dwell wins the startup race: open novice mode at the root menu,
    // centered on the gesture's origin. The pointer is still well within
    // `movementsThreshold` of it, so nothing is active yet.
    'startup -dwell> novice': ({
      fromData: { model, options, origin, stroke },
    }) => ({
      model,
      options,
      menu: model,
      menuCenter: origin,
      active: undefined,
      lastPosition: origin,
      lowerStroke: stroke,
      dwellAnchor: origin,
      dwellStartedAt: Date.now(),
    }),

    'expert -move> expert'({ fromData, inputData: { position } }) {
      const { dwellAnchor, dwellStartedAt, options } = fromData;
      const hasMovedSignificantly =
        dist(dwellAnchor, position) >= options.movementsThreshold;
      return {
        ...fromData,
        stroke: [...fromData.stroke, position],
        dwellAnchor: hasMovedSignificantly ? position : dwellAnchor,
        dwellStartedAt: hasMovedSignificantly ? Date.now() : dwellStartedAt,
      };
    },

    // Mid-expert dwell recognizes the stroke drawn so far as a menu, not a
    // leaf, once, and hands the attempt to the immediate rows below.
    'expert -dwell> recognizing'({ fromData: { model, options, stroke } }) {
      const { analysis, outcome } = recognizeStroke(stroke, model, 'menu');
      return { model, options, stroke, analysis, menu: outcome };
    },

    // A non-root match switches to novice rooted there.
    'recognizing -> novice'({
      fromData: { model, options, stroke, menu },
      skip,
    }) {
      if (menu === undefined || menu.isRoot) {
        return skip();
      }

      const position = last(stroke);
      return {
        model,
        options,
        menu,
        menuCenter: position,
        active: undefined,
        lastPosition: position,
        lowerStroke: stroke,
        dwellAnchor: position,
        dwellStartedAt: Date.now(),
      };
    },

    // Anything else (no match, or the root itself) cancels the expert attempt
    // outright, rather than waiting for a release that recognition already
    // knows will fail.
    'recognizing -> idle': backToIdle,

    'novice -move> novice'({ fromData, inputData: { position } }) {
      const { menuCenter, options, menu, dwellAnchor, dwellStartedAt } =
        fromData;
      const { azymuth, radius } = toPolar(position, menuCenter);
      const active =
        radius < options.deadZoneRadius
          ? undefined
          : menu.getNearestChild(azymuth);
      const hasMovedSignificantly =
        dist(dwellAnchor, position) >= options.movementsThreshold;
      return {
        ...fromData,
        active,
        lastPosition: position,
        dwellAnchor: hasMovedSignificantly ? position : dwellAnchor,
        dwellStartedAt: hasMovedSignificantly ? Date.now() : dwellStartedAt,
      };
    },

    // Pausing on a non-leaf active item opens that submenu: a genuine phase
    // change, even though the destination is named `novice` too. A leaf (or
    // no active item) never opens anything, but still commits a fresh
    // `dwellStartedAt`: the dwell that just fired is spent, and without a
    // fresh value here the residency's `restart` predicate below would see
    // an unchanged one and never re-arm, leaving the next dwell attempt dead
    // even once the pointer moves on. No distance test of its own: an item
    // is active only past the dead zone, and that is the only threshold.
    'novice -dwell> novice'({ fromData }) {
      const { active, lastPosition, lowerStroke, options, model } = fromData;
      if (active === undefined || !isModelMenuItem(active)) {
        return { ...fromData, dwellStartedAt: Date.now() };
      }

      return {
        model,
        options,
        menu: active,
        menuCenter: lastPosition,
        active: undefined,
        lastPosition,
        // The parent menu's own segment becomes part of the trail left
        // behind the new one.
        lowerStroke: [...lowerStroke, ...noviceUpperStroke(fromData)],
        dwellAnchor: lastPosition,
        dwellStartedAt: Date.now(),
      };
    },

    // A standalone menu opens from idle only, at a center that stays put for
    // every level it later shows.
    'idle -open> standalone': ({
      fromData: { model, options },
      inputData: { position },
    }) => ({
      model,
      options,
      menus: [model],
      menuCenter: position,
      active: undefined,
    }),

    'standalone -next> standalone': moveActive('next'),
    'standalone -previous> standalone': moveActive('previous'),
    'standalone -first> standalone': moveActive('first'),
    'standalone -last> standalone': moveActive('last'),

    // The platform moved focus: follow it. Declined for the item that is
    // already active (the echo of focus the machine asked for itself) and for
    // one the displayed level does not hold.
    'standalone -focus> standalone'({ fromData, inputData: { key }, skip }) {
      const item = currentMenu(fromData.menus).items.find(
        (candidate) => candidate.key === key,
      );
      return item === undefined || item === fromData.active
        ? skip()
        : { ...fromData, active: item };
    },

    'standalone -enter> standalone': enterActive,
    'standalone -leave> standalone': leaveLevel,

    // Activating a submenu goes into it, a leaf selects it.
    'standalone -activate> standalone': enterActive,
    'standalone -activate> idle'({
      fromData: { model, options, active },
      skip,
    }) {
      return active === undefined || !isModelLeaf(active)
        ? skip()
        : { model, options };
    },

    // Escape backs out one level, and cancels only from the root.
    'standalone -escape> standalone': leaveLevel,
    'standalone -escape> idle'({ fromData: { model, options, menus }, skip }) {
      return menus.length > 1 ? skip() : { model, options };
    },

    'standalone -exit> idle': backToIdle,
    'standalone -close> idle': backToIdle,

    // Every state a gesture can be in ends the same way, back to idle's own
    // shape. Idle has no gesture to end, and a standalone menu never receives
    // them (its pointer source is suspended).
    'startup -up> idle': backToIdle,
    'expert -up> idle': backToIdle,
    'novice -up> idle': backToIdle,
    'startup -cancel> idle': backToIdle,
    'expert -cancel> idle': backToIdle,
    'novice -cancel> idle': backToIdle,
    // Dispose resets to idle's shape from anywhere, idle included: every
    // state already carries `model`/`options`, so one row covers all four.
    '* -dispose> idle': backToIdle,
  },

  actions: {
    // Declared first: every other action, including the dwell residency,
    // must run after the layout for this commit has already been announced.
    '* -> *'({ to, toData, emit }) {
      if (to === 'recognizing') {
        return;
      }

      emit(
        'layout',
        projectLayout(toNavigationState(to, toData), toData.options),
      );
    },

    startup: {
      run: ({ toData, send }) =>
        armDwellTimer(toData.options.noviceDwellingTime, send),
      // The dwell is armed once, on arrival: a self-transition (growing the
      // stroke below the movement threshold) must never restart it.
      restart: false,
    },

    expert: {
      run: ({ toData, send }) =>
        armDwellTimer(toData.options.noviceDwellingTime, send),
      // Only significant movement bumps `dwellStartedAt`; a self-transition
      // that leaves it unchanged must not restart the pending dwell.
      restart: ({ fromData, toData }) =>
        fromData.dwellStartedAt !== toData.dwellStartedAt,
    },

    novice: {
      run: ({ toData, send }) =>
        armDwellTimer(toData.options.submenuOpeningDelay, send),
      // A fresh `dwellStartedAt` restarts the residency: from significant
      // movement, from the centre a submenu open produces, or from a dwell
      // that fired on a leaf and was consumed. A small move leaves the
      // pending timer alone.
      restart: ({ fromData, toData }) =>
        fromData.dwellStartedAt !== toData.dwellStartedAt,
    },

    'idle -down> startup'({ toData, emit }) {
      emit(
        'start',
        new MarkingMenuStartEvent({
          mode: 'startup',
          position: toData.origin,
        }),
      );
    },

    'idle -open> standalone'({ toData, emit }) {
      emitStandaloneOpen(emit, toData);
    },

    // Every way to go from one standalone level or item to another. A new
    // level announces `open` first, like novice does, then the item it
    // landed on.
    'standalone -> standalone'({ fromData, toData, emit }) {
      const menu = currentMenu(toData.menus);
      const isNewLevel = toData.menus.length !== fromData.menus.length;
      if (isNewLevel) {
        emitStandaloneOpen(emit, toData);
      }

      if (
        toData.active !== undefined &&
        (isNewLevel || toData.active !== fromData.active)
      ) {
        emit(
          'change',
          new MarkingMenuChangeEvent<ModelNode, 'standalone'>({
            mode: 'standalone',
            position: undefined,
            active: toData.active,
            // A new level starts over: `open` already reset the active item.
            previousActive: isNewLevel ? undefined : fromData.active,
            menu,
          }),
        );
      }
    },

    // Selecting is only ever attempted on a leaf, so a non-leaf active item
    // (which the row above declined) never gets here.
    'standalone -activate> idle'({ fromData, emit }) {
      const { active, menus } = fromData;
      if (active === undefined || !isModelLeaf(active)) {
        return;
      }

      emit(
        'select',
        new MarkingMenuSelectEvent<ModelNode, 'standalone'>({
          mode: 'standalone',
          position: undefined,
          selection: active,
          menu: currentMenu(menus),
        }),
      );
    },
    'standalone -escape> idle': cancelStandalone,
    'standalone -exit> idle': cancelStandalone,
    'standalone -close> idle': cancelStandalone,

    // No menu is open in startup or expert, so nothing can be active: `move`
    // always carries `active: undefined` and `menu: undefined` here, and
    // `change` never
    // fires outside novice.
    'startup -move> expert'({ inputData, emit }) {
      emitInactiveMove(emit, 'expert', inputData.position);
    },
    'startup -move> startup'({ inputData, emit }) {
      emitInactiveMove(emit, 'startup', inputData.position);
    },

    'startup -dwell> novice'({ fromData, toData, emit }) {
      emit(
        'open',
        new MarkingMenuOpenEvent({
          mode: 'novice',
          // `dwell` carries no position of its own; the machine holds the
          // last committed one instead.
          position: last(fromData.stroke),
          menu: toData.menu,
          menuCenter: toData.menuCenter,
        }),
      );
    },

    'expert -move> expert'({ inputData, emit }) {
      emitInactiveMove(emit, 'expert', inputData.position);
    },

    // Same shape as `'startup -dwell> novice'`'s own `open`, plus the attempt
    // that found the menu.
    'recognizing -> novice'({ fromData, toData, emit }) {
      emit(
        'open',
        new MarkingMenuOpenEvent({
          mode: 'novice',
          position: last(fromData.stroke),
          menu: toData.menu,
          menuCenter: toData.menuCenter,
          recognition: toRecognition(fromData.stroke, fromData.analysis),
        }),
      );
    },

    // The dwell fired before a release, and recognition found nothing worth
    // switching to: the failed attempt is reported, no selection is made.
    'recognizing -> idle'({ fromData, emit }) {
      const { stroke } = fromData;
      emitTermination(emit, {
        from: 'expert',
        position: last(stroke),
        stroke,
        menu: undefined,
        active: undefined,
        selection: undefined,
        recognition: toRecognition(stroke, fromData.analysis),
      });
    },

    // Same shape as `'startup -dwell> novice'`'s own `open`, one recursion
    // level down. The matching transition row now also commits when the
    // dwell lands on a leaf (to keep the residency alive), so this action
    // only announces `open` when that commit actually changed the menu.
    'novice -dwell> novice'({ fromData, toData, emit }) {
      if (toData.menu === fromData.menu) {
        return;
      }

      emit(
        'open',
        new MarkingMenuOpenEvent({
          mode: 'novice',
          position: toData.menuCenter,
          menu: toData.menu,
          menuCenter: toData.menuCenter,
        }),
      );
    },

    // `move` always fires; `change` only when the nearest item differs from
    // the one the previous commit landed on.
    'novice -move> novice'({ fromData, toData, inputData, emit }) {
      emit(
        'move',
        new MarkingMenuMoveEvent<ModelNode>({
          mode: 'novice',
          position: inputData.position,
          active: toData.active,
          menu: toData.menu,
        }),
      );

      if (toData.active !== fromData.active) {
        emit(
          'change',
          new MarkingMenuChangeEvent<ModelNode>({
            mode: 'novice',
            position: inputData.position,
            active: toData.active,
            previousActive: fromData.active,
            menu: toData.menu,
          }),
        );
      }
    },

    'startup -up> idle': releaseGesture,
    'expert -up> idle': releaseGesture,
    'novice -up> idle': releaseGesture,
    'startup -cancel> idle': cancelGesture,
    'expert -cancel> idle': cancelGesture,
    'novice -cancel> idle': cancelGesture,
  },
});
