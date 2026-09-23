import {
  MarkingMenuCancelEvent,
  MarkingMenuMoveEvent,
  MarkingMenuSelectEvent,
  type MarkingMenuCancelReason,
  type MarkingMenuMode,
  type MarkingMenuRecognition,
} from '../events.js';
import {
  recognizeStroke,
  type StrokeCut,
} from '../recognizer/recognize-mm-stroke.js';
import { strokeLength } from '../recognizer/stroke-length.js';
import {
  isModelLeaf,
  type ModelItem,
  type ModelLeaf,
  type ModelMenu,
  type ModelNode,
} from '../types.js';
import { type Point } from '../utils.js';
import { noviceUpperStroke } from './layout-view.js';
import type {
  MachineStates,
  NavigationFeedbackAnnouncement,
} from './machine.js';

/**
 Shared body of the three startup/expert move actions: no menu is open in
 either state, so `move` always carries an undefined `active` and `menu`
 there.
 */
export function emitInactiveMove(
  emit: (name: 'move', data: MarkingMenuMoveEvent) => void,
  mode: 'startup' | 'expert',
  position: Point,
): void {
  emit(
    'move',
    new MarkingMenuMoveEvent<ModelNode>({
      mode,
      position,
      source: 'gesture',
      activeItem: undefined,
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
export function toRecognition(
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

/**
 Shared body of the `startup`, `expert`, and `novice` dwell residencies: arm a
 `dwell` timer for `delayMs` and clear it on exit, whatever ends the residency,
 whether that is leaving the state or disposal.
 */
export function armDwellTimer(
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
 Shared tail of every action that ends a gesture: `up`, `cancel`, and the
 expert dwell that finds nothing to switch to. Announce `feedback`, then
 `select` or `cancel` depending on `outcome`: the leaf that was selected, or
 why nothing was. The latter two callers never attempt a selection.
 */
export function emitTermination(
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
    outcome,
    recognition,
  }: {
    readonly from: Exclude<MarkingMenuMode, 'standalone'>;
    readonly position: Point;
    readonly stroke: readonly Point[];
    readonly menu: ModelMenu | undefined;
    readonly active: ModelItem | undefined;
    readonly outcome:
      | { readonly selection: ModelLeaf }
      | {
          readonly reason: MarkingMenuCancelReason<
            Exclude<MarkingMenuMode, 'standalone'>
          >;
        };
    // Present exactly when recognition ran for this termination.
    readonly recognition: MarkingMenuRecognition | undefined;
  },
): void {
  emit('feedback', { stroke, canceled: 'reason' in outcome });
  if ('reason' in outcome) {
    emit(
      'cancel',
      new MarkingMenuCancelEvent<ModelNode>({
        mode: from,
        position,
        source: 'gesture',
        activeItem: active,
        menu,
        reason: outcome.reason,
        recognition,
      }),
    );
  } else {
    emit(
      'select',
      new MarkingMenuSelectEvent({
        mode: from,
        position,
        source: 'gesture',
        selection: outcome.selection,
        menu,
        recognition,
      }),
    );
  }
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
export function releaseGesture({
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
    outcome:
      selection === undefined ? { reason: 'no-selection' } : { selection },
    recognition,
  });
}

/**
 A pointer canceled outright never selects, regardless of what was active or
 what the stroke looks like: recognition never runs, and a novice active item,
 leaf or not, carries through to `cancel.active` unchanged.
 */
export function cancelGesture({
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
    outcome: { reason: 'interrupted' },
    recognition: undefined,
  });
}
