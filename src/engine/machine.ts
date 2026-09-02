import { machine, type } from 'totorobot';
import {
  MarkingMenuCancelEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
  type MarkingMenuChangeEvent,
  type MarkingMenuMode,
  type MarkingMenuMoveEvent,
} from '../events.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import type { AnyModelNode, ModelLeaves, ModelMenus } from '../types.js';
import { dist, type Point } from '../utils.js';
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
};

type Deps = {
  readonly model: AnyModelNode;
  readonly options: NavigationOptions;
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
  idle: { readonly deps: Deps };
  startup: {
    readonly deps: Deps;
    readonly origin: Point;
    readonly stroke: readonly Point[];
  };
  expert: { readonly deps: Deps; readonly stroke: readonly Point[] };
  novice: {
    readonly deps: Deps;
    readonly menu: AnyModelNode;
    readonly menuCenter: Point;
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
 one of `NavigationState`'s variants field-for-field, `deps` aside.
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
  readonly menu: N | null;
}): MarkingMenuCancelEvent<N> {
  return new MarkingMenuCancelEvent<N>({ ...data, active: null } as unknown as {
    mode: MarkingMenuMode;
    position: Point;
    active: null;
    menu: ModelMenus<N> | null;
  });
}

export const navigationMachine = machine({
  inputs: type<NavigationInputs>(),
  states: type<NavigationStates>(),
  outputs: type<NavigationOutputs>(),

  initial: 'idle',

  transitions: {
    'idle -down> startup': ({ fromData, inputData }) => ({
      deps: fromData.deps,
      origin: inputData.position,
      stroke: [inputData.position],
    }),
    'idle -dispose> idle': ({ fromData }) => fromData,

    'startup -move> expert'({ fromData, inputData, skip }) {
      const stroke = [...fromData.stroke, inputData.position];
      return dist(fromData.origin, inputData.position) >=
        fromData.deps.options.movementsThreshold
        ? { deps: fromData.deps, stroke }
        : skip();
    },
    'startup -move> startup': ({ fromData, inputData }) => ({
      ...fromData,
      stroke: [...fromData.stroke, inputData.position],
    }),
    'startup -up> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'startup -cancel> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'startup -dispose> idle': ({ fromData }) => ({ deps: fromData.deps }),
    // The dwell wins the startup race: open novice mode at the root menu,
    // centered on the gesture's origin. The pointer is still well within
    // `movementsThreshold` of it, so nothing is active yet.
    'startup -dwell> novice': ({ fromData }) => ({
      deps: fromData.deps,
      menu: fromData.deps.model,
      menuCenter: fromData.origin,
      upperStroke: [fromData.origin],
      lowerStroke: fromData.stroke,
    }),

    'expert -move> expert': ({ fromData, inputData }) => ({
      ...fromData,
      stroke: [...fromData.stroke, inputData.position],
    }),
    'expert -up> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'expert -cancel> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'expert -dispose> idle': ({ fromData }) => ({ deps: fromData.deps }),

    'novice -up> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'novice -cancel> idle': ({ fromData }) => ({ deps: fromData.deps }),
    'novice -dispose> idle': ({ fromData }) => ({ deps: fromData.deps }),
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
        }, toData.deps.options.noviceDwellingTime);
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

    // The shared termination policy: recognize the gesture drawn so far
    // (unless skipped) and announce `select` or `cancel`. One wildcard action
    // per input covers startup, expert and novice, replacing the old
    // `finish()` helper.
    '* -up> idle'({ from, fromData, inputData, emit }) {
      const { position } = inputData;
      let stroke: readonly Point[];
      let menu: AnyModelNode | null;
      let isSkipRecognition: boolean;

      if (from === 'startup') {
        stroke = [...fromData.stroke, position];
        menu = null;
        // The pointer never moved at all: every recorded point sits at the
        // same position, so there is nothing to recognize.
        isSkipRecognition = strokeLength(stroke) === 0;
      } else if (from === 'expert') {
        stroke = [...fromData.stroke, position];
        menu = null;
        isSkipRecognition = false;
      } else {
        stroke = [...fromData.lowerStroke, ...fromData.upperStroke, position];
        menu = fromData.menu;
        // Novice selection is proximity-based hit-testing, not expert-style
        // stroke recognition, and hit-testing isn't implemented yet: every
        // release cancels for now.
        isSkipRecognition = true;
      }

      const selection = isSkipRecognition
        ? null
        : recognizeMarkingMenuStroke(stroke, fromData.deps.model);
      emit('feedback', { stroke, canceled: selection === null });

      if (selection === null) {
        emit('cancel', cancelEvent({ mode: from, position, menu }));
      } else {
        emit('select', selectEvent({ mode: from, position, selection, menu }));
      }
    },

    // A pointer cancelled outright never selects, regardless of what the
    // stroke looks like: recognition never runs.
    '* -cancel> idle'({ from, fromData, inputData, emit }) {
      const { position } = inputData;
      let stroke: readonly Point[];
      let menu: AnyModelNode | null;

      if (from === 'novice') {
        stroke = [...fromData.lowerStroke, ...fromData.upperStroke, position];
        menu = fromData.menu;
      } else {
        stroke = [...fromData.stroke, position];
        menu = null;
      }

      emit('feedback', { stroke, canceled: true });
      emit('cancel', cancelEvent({ mode: from, position, menu }));
    },
  },
});
