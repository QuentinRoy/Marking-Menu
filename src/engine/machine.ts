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
import { projectLayout } from './layout-view.js';

/*
 The navigation machine, declared as a totorobot definition rather than a
 hand-rolled reducer. `machine()` is inert data; `runtime.ts` is the only
 place that ever calls `.start()` on it.

 A definition is a single, non-generic value, so every field that would
 otherwise carry the caller's precise model type `M` is erased to the bare
 `AnyModelNode` here instead: `ModelMenus<AnyModelNode>` and
 `ModelLeaves<AnyModelNode>` both collapse to `never` (their `isLeaf`/`isRoot`
 conditions can never resolve against a plain `boolean`), so nothing in this
 file can name them. `runtime.ts` stays generic over the caller's real `M` and
 casts back at the boundary, the same erase-and-cast shape `renderer.ts`
 already uses for `MenuLayoutModel`.
 */

export type NavigationOptions = {
  readonly movementsThreshold: number;
  readonly noviceDwellingTime: number;
  readonly minSelectionDist: number;
};

/**
 The boundary input shape `pointer-source.ts` sends: unrelated to the
 machine's own (shorter) input vocabulary, so that layer never has to know
 about it.
 */
export type NavigationInput =
  | { readonly type: 'pointer.down'; readonly position: Point }
  | { readonly type: 'pointer.move'; readonly position: Point }
  | { readonly type: 'pointer.up'; readonly position: Point }
  | { readonly type: 'pointer.cancel'; readonly position: Point };

/**
 The boundary view of the machine's current phase: what `layout-view.ts`
 projects from. Kept as a plain discriminated union, independent of
 totorobot's own `{ name, data }` shape, so `projectLayout` needs no changes.
 */
export type NavigationState<M extends AnyModelNode> =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'startup';
      readonly origin: Point;
      readonly stroke: readonly Point[];
    }
  | { readonly phase: 'expert'; readonly stroke: readonly Point[] }
  | {
      readonly phase: 'novice';
      readonly menu: ModelMenus<M>;
      readonly menuCenter: Point;
      readonly active: ModelItems<M> | null;
      readonly upperStroke: readonly Point[];
      readonly lowerStroke: readonly Point[];
    };

type NavigationInputs = {
  down: { readonly position: Point };
  move: { readonly position: Point };
  up: { readonly position: Point };
  cancel: { readonly position: Point };
  dwell: undefined;
  dispose: undefined;
};

type NavigationStates = {
  idle: { readonly model: AnyModelNode; readonly options: NavigationOptions };
  startup: {
    readonly model: AnyModelNode;
    readonly options: NavigationOptions;
    readonly origin: Point;
    readonly stroke: readonly Point[];
  };
  expert: {
    readonly model: AnyModelNode;
    readonly options: NavigationOptions;
    readonly stroke: readonly Point[];
  };
  novice: {
    readonly model: AnyModelNode;
    readonly options: NavigationOptions;
    readonly menu: AnyModelNode;
    readonly menuCenter: Point;
    readonly active: AnyModelNode | null;
    readonly upperStroke: readonly Point[];
    readonly lowerStroke: readonly Point[];
  };
};

/**
 The layout announcement's payload: `LayoutView<AnyModelNode>` with the same
 erasure applied to its own `menu.model`, for the same reason `NavigationStates`
 erases `novice.menu`.
 */
export type NavigationLayoutAnnouncement = {
  readonly cursor: 'default' | 'crosshair' | 'none';
  readonly menu: null | {
    readonly model: AnyModelNode;
    readonly center: Point;
    readonly activeKey: string | null;
  };
  readonly upperStroke: readonly Point[] | null;
  readonly lowerStroke: readonly Point[] | null;
};

export type NavigationFeedbackAnnouncement = {
  readonly stroke: readonly Point[];
  readonly canceled: boolean;
};

type NavigationOutputs = {
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
  to: keyof NavigationStates,
  toData: NavigationStates[keyof NavigationStates],
): NavigationState<AnyModelNode> {
  return { phase: to, ...toData } as unknown as NavigationState<AnyModelNode>;
}

/*
 Event-construction helpers, generic in a fresh `N`. `ModelMenus<AnyModelNode>`
 and `ModelLeaves<AnyModelNode>` both collapse to `never` (see the module
 comment above), so `MarkingMenuOpenEvent<AnyModelNode>` and its siblings
 cannot be constructed directly from the erased `menu`/`selection` values this
 file has. A generic `N` keeps those conditionals deferred, exactly like the
 rest of the codebase's `as unknown as ModelMenus<M>` casts, so the erasure
 crossing happens once per event kind instead of at every call site.
 */
function openEvent<N extends AnyModelNode>(data: {
  readonly position: Point;
  readonly menu: N;
  readonly menuCenter: Point;
}): MarkingMenuOpenEvent<N> {
  return new MarkingMenuOpenEvent<N>(
    data as unknown as {
      position: Point;
      menu: ModelMenus<N>;
      menuCenter: Point;
    },
  );
}

function moveEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly active: N | null;
  readonly menu: N | null;
}): MarkingMenuMoveEvent<N> {
  return new MarkingMenuMoveEvent<N>(
    data as unknown as {
      mode: MarkingMenuMode;
      position: Point;
      active: ModelItems<N> | null;
      menu: ModelMenus<N> | null;
    },
  );
}

/**
 Shared body of the three startup/expert move actions: no menu is open in
 either state, so `move` always carries a null `active` and `menu` there.
 */
function emitNullActiveMove(
  emit: (name: 'move', data: MarkingMenuMoveEvent<AnyModelNode>) => void,
  mode: 'startup' | 'expert',
  position: Point,
): void {
  emit('move', moveEvent({ mode, position, active: null, menu: null }));
}

function changeEvent<N extends AnyModelNode>(data: {
  readonly position: Point;
  readonly active: N | null;
  readonly previousActive: N | null;
  readonly menu: N;
}): MarkingMenuChangeEvent<N> {
  return new MarkingMenuChangeEvent<N>(
    data as unknown as {
      position: Point;
      active: ModelItems<N> | null;
      previousActive: ModelItems<N> | null;
      menu: ModelMenus<N>;
    },
  );
}

function selectEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly selection: N;
  readonly menu: N | null;
}): MarkingMenuSelectEvent<N> {
  return new MarkingMenuSelectEvent<N>(
    data as unknown as {
      mode: MarkingMenuMode;
      position: Point;
      selection: ModelLeaves<N>;
      menu: ModelMenus<N> | null;
    },
  );
}

function cancelEvent<N extends AnyModelNode>(data: {
  readonly mode: MarkingMenuMode;
  readonly position: Point;
  readonly active: N | null;
  readonly menu: N | null;
}): MarkingMenuCancelEvent<N> {
  return new MarkingMenuCancelEvent<N>(
    data as unknown as {
      mode: MarkingMenuMode;
      position: Point;
      active: ModelItems<N> | null;
      menu: ModelMenus<N> | null;
    },
  );
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
  fromData: NavigationStates['startup' | 'expert' | 'novice'],
  position: Point,
): {
  readonly stroke: readonly Point[];
  readonly menu: AnyModelNode | null;
  readonly active: AnyModelNode | null;
} {
  if ('lowerStroke' in fromData) {
    const { lowerStroke, upperStroke, menu, active } = fromData;
    return {
      stroke: [...lowerStroke, ...upperStroke, position],
      menu,
      active,
    };
  }

  return { stroke: [...fromData.stroke, position], menu: null, active: null };
}

export const navigationMachine = machine({
  inputs: type<NavigationInputs>(),
  states: type<NavigationStates>(),
  outputs: type<NavigationOutputs>(),

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
    }),

    'startup -move> expert'({
      fromData: { model, options, origin, stroke },
      inputData: { position },
      skip,
    }) {
      const newStroke = [...stroke, position];
      return dist(origin, position) >= options.movementsThreshold
        ? { model, options, stroke: newStroke }
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
      active: null,
      upperStroke: [origin],
      lowerStroke: stroke,
    }),

    'expert -move> expert': ({ fromData, inputData }) => ({
      ...fromData,
      stroke: [...fromData.stroke, inputData.position],
    }),

    'novice -move> novice'({ fromData, inputData: { position } }) {
      const { menuCenter, options, menu } = fromData;
      const { azymuth, radius } = toPolar(position, menuCenter);
      const active =
        radius < options.minSelectionDist
          ? null
          : menu.getNearestChild(azymuth);
      return {
        ...fromData,
        active,
        upperStroke: [...fromData.upperStroke, position],
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
      emit('layout', projectLayout(toNavigationState(to, toData)));
    },

    startup: {
      run({ toData, send }) {
        const timer = setTimeout(() => {
          send('dwell');
        }, toData.options.noviceDwellingTime);
        return () => {
          clearTimeout(timer);
        };
      },
      // The dwell is armed once, on arrival: a self-transition (growing the
      // stroke below the movement threshold) must never restart it.
      restart: false,
    },

    'idle -down> startup'({ toData, emit }) {
      emit('start', new MarkingMenuStartEvent({ position: toData.origin }));
    },

    // No menu is open in startup or expert, so nothing can be active: `move`
    // always carries `active: null` and `menu: null` here, and `change` never
    // fires outside novice.
    'startup -move> expert'({ inputData, emit }) {
      emitNullActiveMove(emit, 'expert', inputData.position);
    },
    'startup -move> startup'({ inputData, emit }) {
      emitNullActiveMove(emit, 'startup', inputData.position);
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
      emitNullActiveMove(emit, 'expert', inputData.position);
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
      let selection: AnyModelNode | null;
      if (from === 'novice') {
        selection = active?.isLeaf === true ? active : null;
      } else if (from === 'startup' && strokeLength(stroke) === 0) {
        selection = null;
      } else {
        selection = recognizeMarkingMenuStroke(stroke, fromData.model);
      }

      emit('feedback', { stroke, canceled: selection === null });

      if (selection === null) {
        emit('cancel', cancelEvent({ mode: from, position, active, menu }));
      } else {
        emit('select', selectEvent({ mode: from, position, selection, menu }));
      }
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

      emit('feedback', { stroke, canceled: true });
      emit('cancel', cancelEvent({ mode: from, position, active, menu }));
    },
  },
});
