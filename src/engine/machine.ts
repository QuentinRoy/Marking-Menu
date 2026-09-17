import { machine, type } from 'totorobot';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type MarkingMenuMode,
} from '../events.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import type {
  AnyModelNode,
  ModelItems,
  ModelLeaves,
  ModelMenus,
} from '../types.js';
import { dist, toPolar, type Point } from '../utils.js';
import { noviceUpperStroke, projectLayout } from './layout-view.js';

/*
 The navigation machine, declared as a totorobot definition rather than a
 hand-rolled reducer. `machine()` is inert data; `runtime.ts` is the only
 place that ever calls `.start()` on it.

 A definition is a single, non-generic value, so every field that would
 otherwise carry the caller's precise model type `M` is erased to the bare
 `AnyModelNode` here instead. `runtime.ts` stays generic over the caller's real
 `M` and casts back at the boundary, the same erase-and-cast shape
 `renderer.ts` already uses for `MenuLayoutModel`.
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
};

type PointerInputName = 'down' | 'move' | 'up' | 'cancel';

/**
 The boundary input shape `pointer-source.ts` sends: unrelated to the
 machine's own (shorter) input vocabulary, so that layer never has to know
 about it. Derived from `MachineInputs`' pointer keys with a `pointer.`
 prefix, so the two can't drift apart.
 */
export type NavigationInput = {
  [K in PointerInputName]: { readonly type: `pointer.${K}` } & MachineInputs[K];
}[PointerInputName];

/**
 Each phase's fields, factored out before `NavigationState` tags on a
 `phase` discriminant or `MachineStates` adds `model`/`options`: the one
 place either lists them, so the two can't diverge. Parameterized over the
 menu/active node types since each needs a different projection:
 `NavigationState` gets the caller's own `ModelMenus<M>`/`ModelItems<M>`,
 `MachineStates` the file's erased `AnyModelNode` (see the module comment
 above).
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
export type NavigationState<M extends AnyModelNode> = {
  [K in keyof NavigationPhaseFields<ModelMenus<M>, ModelItems<M>>]: {
    readonly phase: K;
  } & NavigationPhaseFields<ModelMenus<M>, ModelItems<M>>[K];
}[keyof NavigationPhaseFields<ModelMenus<M>, ModelItems<M>>];

type MachineStates = {
  [K in keyof NavigationPhaseFields<AnyModelNode, AnyModelNode>]: {
    readonly model: AnyModelNode;
    readonly options: NavigationOptions;
  } & NavigationPhaseFields<AnyModelNode, AnyModelNode>[K];
};

/**
 The layout announcement's payload: `LayoutView<AnyModelNode>` with the same
 erasure applied to its own `menu.model`, for the same reason `MachineStates`
 erases `novice.menu`.
 */
export type NavigationLayoutAnnouncement = {
  readonly cursor: 'default' | 'crosshair' | 'none';
  readonly menu:
    | undefined
    | {
        readonly model: AnyModelNode;
        readonly center: Point;
        readonly activeKey: string | undefined;
      };
  readonly upperStroke: readonly Point[] | undefined;
  readonly lowerStroke: readonly Point[] | undefined;
  readonly indicator:
    | undefined
    | {
        // When the current dwell began: the renderer computes growth
        // progress directly from this and `delayMs`, rather than tracking
        // restart state of its own.
        readonly startedAt: number;
        // Where the indicator draws right now. Unlike `startedAt`, always
        // the pointer's current position: a dwell only restarts on
        // significant movement, so using its anchor to draw would lag the
        // pointer by up to `movementsThreshold`.
        readonly position: Point;
        readonly delayMs: number;
      };
};

export type NavigationFeedbackAnnouncement = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

type MachineOutputs = {
  start: MarkingMenuStartEvent;
  move: MarkingMenuMoveEvent<AnyModelNode>;
  open: MarkingMenuOpenEvent<AnyModelNode>;
  change: MarkingMenuChangeEvent<AnyModelNode>;
  select: MarkingMenuSelectEvent<AnyModelNode>;
  cancel: MarkingMenuCancelEvent<AnyModelNode>;
  // Internal: consumed only by runtime.ts, never forwarded to a consumer.
  layout: NavigationLayoutAnnouncement;
  feedback: NavigationFeedbackAnnouncement;
};

/**
 Reassemble the boundary `NavigationState` from a committed `{ to, toData }`
 pair, for `projectLayout`. The cast is the same erasure-crossing every
 model-shaped field in this file needs: `toData`'s real shape already matches
 one of `NavigationState`'s variants field-for-field, `model`/`options` aside.
 */
function toNavigationState(
  to: keyof MachineStates,
  toData: MachineStates[keyof MachineStates],
): NavigationState<AnyModelNode> {
  return { phase: to, ...toData } as unknown as NavigationState<AnyModelNode>;
}

/*
 Event-construction helpers, generic in a fresh `N`, taking each field at the
 type the event itself declares for it. They used to take a bare `N` and cast,
 because `ModelMenus<AnyModelNode>` and its siblings collapsed to `never` and
 nothing here could produce a value of them; now that those resolve to
 `AnyModelNode`, the erased `menu`/`selection` values this file holds satisfy
 the declared types directly and the casts are gone.

 A conditional type is not an inference site, so `N` is never inferred from an
 argument: at every call site here it falls back to its `AnyModelNode`
 constraint, which is exactly the erasure this file works in. A caller holding
 a real `M` can still pass it explicitly and get a precisely typed event back,
 checked rather than cast.
 */
function openEvent<N extends AnyModelNode>(data: {
  readonly position: Point;
  readonly menu: ModelMenus<N>;
  readonly menuCenter: Point;
}): MarkingMenuOpenEvent<N> {
  return new MarkingMenuOpenEvent<N>(data);
}

function moveEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly active: ModelItems<N> | undefined;
  readonly menu: ModelMenus<N> | undefined;
}): MarkingMenuMoveEvent<N> {
  return new MarkingMenuMoveEvent<N>(data);
}

/**
 Shared body of the three startup/expert move actions: no menu is open in
 either state, so `move` always carries an undefined `active` and `menu`
 there.
 */
function emitInactiveMove(
  emit: (name: 'move', data: MarkingMenuMoveEvent<AnyModelNode>) => void,
  mode: 'startup' | 'expert',
  position: Point,
): void {
  emit(
    'move',
    moveEvent({ mode, position, active: undefined, menu: undefined }),
  );
}

function changeEvent<N extends AnyModelNode>(data: {
  readonly position: Point;
  readonly active: ModelItems<N> | undefined;
  readonly previousActive: ModelItems<N> | undefined;
  readonly menu: ModelMenus<N>;
}): MarkingMenuChangeEvent<N> {
  return new MarkingMenuChangeEvent<N>(data);
}

function selectEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly selection: ModelLeaves<N>;
  readonly menu: ModelMenus<N> | undefined;
}): MarkingMenuSelectEvent<N> {
  return new MarkingMenuSelectEvent<N>(data);
}

function cancelEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly active: ModelItems<N> | undefined;
  readonly menu: ModelMenus<N> | undefined;
}): MarkingMenuCancelEvent<N> {
  return new MarkingMenuCancelEvent<N>(data);
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
  readonly menu: AnyModelNode | undefined;
  readonly active: AnyModelNode | undefined;
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
  emit: ((name: 'feedback', data: NavigationFeedbackAnnouncement) => void) &
    ((name: 'cancel', data: MarkingMenuCancelEvent<AnyModelNode>) => void) &
    ((name: 'select', data: MarkingMenuSelectEvent<AnyModelNode>) => void),
  {
    from,
    position,
    stroke,
    menu,
    active,
    selection,
  }: {
    readonly from: MarkingMenuMode;
    readonly position: Point;
    readonly stroke: readonly Point[];
    readonly menu: AnyModelNode | undefined;
    readonly active: AnyModelNode | undefined;
    readonly selection: AnyModelNode | undefined;
  },
): void {
  emit('feedback', { stroke, canceled: selection === undefined });
  if (selection === undefined) {
    emit('cancel', cancelEvent({ mode: from, position, active, menu }));
  } else {
    emit('select', selectEvent({ mode: from, position, selection, menu }));
  }
}

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
    // leaf: a non-root match switches to novice rooted there. Anything else
    // (no match, or the root itself) falls through to the unconditional
    // row below, which cancels the expert attempt outright rather than
    // waiting for a release that recognition already knows will fail.
    'expert -dwell> novice'({ fromData: { model, options, stroke }, skip }) {
      const menu = recognizeMarkingMenuStroke(stroke, model, {
        maxDepth: -1,
        requireMenu: true,
      });
      if (menu === undefined || menu.isRoot) {
        return skip();
      }

      const position = stroke.at(-1) as Point;
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

    // The row above declined: no menu was recognized, or it was the root.
    'expert -dwell> idle'({ fromData: { model, options } }) {
      return { model, options };
    },

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
      if (active === undefined || active.isLeaf) {
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

    // Idle has no gesture to end, so both decline there; every other state
    // (startup, expert, novice) resets to idle's own shape.
    '* -up> idle': ({ from, fromData: { model, options }, skip }) =>
      from === 'idle' ? skip() : { model, options },
    '* -cancel> idle': ({ from, fromData: { model, options }, skip }) =>
      from === 'idle' ? skip() : { model, options },
    // Dispose resets to idle's shape from anywhere, idle included: every
    // state already carries `model`/`options`, so one row covers all four.
    '* -dispose> idle': ({ fromData: { model, options } }) => ({
      model,
      options,
    }),
  },

  actions: {
    // Declared first: every other action, including the dwell residency,
    // must run after the layout for this commit has already been announced.
    '* -> *'({ to, toData, emit }) {
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
      emit('start', new MarkingMenuStartEvent({ position: toData.origin }));
    },

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
        openEvent({
          // `dwell` carries no position of its own; the machine holds the
          // last committed one instead. `fromData.stroke` always starts with
          // the origin and is only ever appended to, so it is never empty.
          position: fromData.stroke.at(-1) as Point,
          menu: toData.menu,
          menuCenter: toData.menuCenter,
        }),
      );
    },

    'expert -move> expert'({ inputData, emit }) {
      emitInactiveMove(emit, 'expert', inputData.position);
    },

    // Same shape as `'startup -dwell> novice'`'s own `open`: the row above
    // already confirmed the recognized menu is eligible, so this action only
    // ever announces one.
    'expert -dwell> novice'({ fromData, toData, emit }) {
      emit(
        'open',
        openEvent({
          position: fromData.stroke.at(-1) as Point,
          menu: toData.menu,
          menuCenter: toData.menuCenter,
        }),
      );
    },

    // No selection was ever attempted: the dwell fired before a release,
    // and recognition already found nothing worth switching to.
    'expert -dwell> idle'({ fromData, emit }) {
      const { stroke } = fromData;
      const position = stroke.at(-1) as Point;
      emitTermination(emit, {
        from: 'expert',
        position,
        stroke,
        menu: undefined,
        active: undefined,
        selection: undefined,
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
        openEvent({
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
        moveEvent({
          mode: 'novice',
          position: inputData.position,
          active: toData.active,
          menu: toData.menu,
        }),
      );

      if (toData.active !== fromData.active) {
        emit(
          'change',
          changeEvent({
            position: inputData.position,
            active: toData.active,
            previousActive: fromData.active,
            menu: toData.menu,
          }),
        );
      }
    },

    // The shared termination policy: recognize the gesture drawn so far
    // (unless skipped) and announce `select` or `cancel`. One wildcard action
    // per input covers startup, expert and novice, replacing the old
    // `finish()` helper. `from` also admits `idle` here, since the matching
    // transition row's own source is a wildcard too; that row already
    // declines idle with `skip()`, so this action never actually runs for
    // it, but totorobot checks table membership rather than reachability,
    // so the type still has to be narrowed here.
    '* -up> idle'({ from, fromData, inputData, emit }) {
      if (from === 'idle') {
        return;
      }

      const { position } = inputData;
      const { stroke, menu, active } = terminationContext(fromData, position);

      // Novice release hit-tests the item already tracked as active rather
      // than running stroke recognition: only a leaf can be selected, and a
      // non-leaf (or absent) active item carries straight through to
      // `cancel.active` unchanged, since it is precisely the thing that was
      // not selected. Startup with zero movement has nothing to recognize;
      // expert, and startup with sub-threshold movement, always attempt it.
      let selection: AnyModelNode | undefined;
      if (from === 'novice') {
        selection = active?.isLeaf === true ? active : undefined;
      } else if (from === 'startup' && strokeLength(stroke) === 0) {
        selection = undefined;
      } else {
        selection = recognizeMarkingMenuStroke(stroke, fromData.model);
      }

      emitTermination(emit, {
        from,
        position,
        stroke,
        menu,
        active,
        selection,
      });
    },

    // A pointer cancelled outright never selects, regardless of what was
    // active or what the stroke looks like: recognition never runs, and a
    // novice active item, leaf or not, carries through to `cancel.active`
    // unchanged (objective 8). Same `idle` narrowing as the `-up>` action
    // above.
    '* -cancel> idle'({ from, fromData, inputData, emit }) {
      if (from === 'idle') {
        return;
      }

      const { position } = inputData;
      const { stroke, menu, active } = terminationContext(fromData, position);

      emitTermination(emit, {
        from,
        position,
        stroke,
        menu,
        active,
        selection: undefined,
      });
    },
  },
});
