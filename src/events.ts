import type { TypedEventEmitter } from './typed-event-emitter.js';
import type {
  ModelItems,
  ModelLeaves,
  ModelMenus,
  ModelNode,
} from './types.js';
import type { Point } from './utils.js';

/*
 The public event contract: the events {@link createMarkingMenu}'s controller
 dispatches, and the typed facade it dispatches them through.
 */

/* -------------------------------------------------------------------------- *
 * Shared payload types
 * -------------------------------------------------------------------------- */

/**
 The mode the menu interaction is in when an event is dispatched. A pointer
 gesture starts in `startup`, then becomes `novice` once the menu is visible
 or `expert` while a stroke is drawn without one. `standalone` is a menu
 displayed with the controller's `open()`, with no gesture in progress: see
 {@link MarkingMenuEventSource} for what operates it.
 */
export type MarkingMenuMode = 'startup' | 'novice' | 'expert' | 'standalone';

/**
 Why a gesture or menu ended without a selection. `interrupted`: the browser
 canceled the pointer. `no-selection`: the gesture finished with nothing to
 select. `dismissed`: a menu shown with `open()` was closed, by `close()`, the
 Escape key, or Tab.
 */
export type MarkingMenuCancelReason<
  Mode extends MarkingMenuMode = MarkingMenuMode,
> = Mode extends 'standalone' ? 'dismissed' : 'interrupted' | 'no-selection';

/**
 What caused an event, independent of `mode`. `gesture` is constant across
 `startup`, `novice`, and `expert`: every event there stems from the same
 pointer-drawn stroke. In `standalone`, it is `pointer` (hover, press, drag,
 click, or tap), `keyboard` (arrow keys, Enter, Escape, or Tab), `api` (an
 explicit `open()` or `close()` call), or `focus-loss` (the menu lost DOM
 focus for an otherwise-unknown reason).
 */
export type MarkingMenuEventSource =
  'pointer' | 'keyboard' | 'gesture' | 'api' | 'focus-loss';

/**
 An event's `position` field: a point outside standalone mode, and a point or
 `undefined` inside it (a point when `source` is `'pointer'`, `undefined`
 otherwise).
 */
type StandalonePosition<Mode extends MarkingMenuMode> =
  Mode extends 'standalone' ? Point | undefined : Point;

/**
 One piece of a stroke, between two corners.

 Its shape and meaning are covered by semver: a recognizer change that moves
 the pieces cut from the same stroke and menu is a breaking change.
 */
export type MarkingMenuStrokeSegment = {
  /**
  The two points the piece spans, in client coordinates (pixels).
  */
  readonly points: readonly [Point, Point];
};

/**
 What the recognizer made of a stroke.

 Its shape and meaning are covered by semver: a recognizer change that moves
 the corners or pieces for the same stroke and menu is a breaking change.
 */
export type MarkingMenuStrokeAnalysis = {
  /**
   The points along the stroke recognized as corners, start and end included,
   in client coordinates (pixels).
   */
  readonly articulationPoints: readonly Point[];
  /**
   The pieces the stroke was cut into between corners. Pieces too short to be a
   deliberate move are dropped.
   */
  readonly segments: readonly MarkingMenuStrokeSegment[];
};

/**
 The stroke the recognizer was given, and how it cut it. Present on an event
 exactly when recognition ran.

 Its shape and meaning are covered by semver.
 */
export type MarkingMenuRecognition = {
  /**
  The stroke, in client coordinates (pixels).
  */
  readonly stroke: readonly Point[];
  /**
  How the stroke was cut into corners and pieces.
  */
  readonly analysis: MarkingMenuStrokeAnalysis;
};

/* -------------------------------------------------------------------------- *
 * Event classes
 * -------------------------------------------------------------------------- */

/**
 What every marking menu event has in common: the mode the interaction was in,
 what caused it, and the pointer position, all at dispatch time. Outside
 standalone mode `position` is always a point; in standalone it is a point
 when `source` is `'pointer'`, and `undefined` otherwise. Check `source`, not
 `mode`, to know which.

 Not a DOM `Event`: this library has no DOM target, no bubbling, and no
 default action to prevent, so `Event`'s machinery would all be dead weight.
 */
export abstract class MarkingMenuEventBase<
  Mode extends MarkingMenuMode = MarkingMenuMode,
> {
  readonly #mode: Mode;
  readonly #position: StandalonePosition<Mode>;
  readonly #source: MarkingMenuEventSource;
  readonly type: string;

  constructor(
    type: string,
    data: {
      readonly mode: Mode;
      readonly position: StandalonePosition<Mode>;
      readonly source: MarkingMenuEventSource;
    },
  ) {
    this.type = type;
    this.#mode = data.mode;
    this.#position = data.position;
    this.#source = data.source;
  }

  /**
  The mode the interaction was in when this event was dispatched. See
  {@link MarkingMenuMode}.
  */
  get mode(): Mode {
    return this.#mode;
  }

  /**
   The pointer position at the time this event was dispatched, in standalone
   mode only defined when `source` is `'pointer'`.
   */
  get position(): StandalonePosition<Mode> {
    return this.#position;
  }

  /**
  What caused this event. See {@link MarkingMenuEventSource}.
  */
  get source(): MarkingMenuEventSource {
    return this.#source;
  }
}

/**
 Dispatched once, as the first event of a gesture, when a primary pointer goes
 down.
 */
export class MarkingMenuStartEvent<
  Mode extends 'startup' = 'startup',
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'start' {
    return 'start';
  }

  declare readonly type: 'start';

  constructor(data: {
    readonly mode: Mode;
    readonly position: StandalonePosition<Mode>;
    readonly source: MarkingMenuEventSource;
  }) {
    super(MarkingMenuStartEvent.type, data);
  }
}

/**
 Dispatched when a menu level is displayed: the dwell that starts novice mode,
 a submenu dwell while already in novice mode, or, in standalone mode, the
 root on `open()` and every level entered or left afterward.
 */
export class MarkingMenuOpenEvent<
  Model extends ModelNode = ModelNode,
  Mode extends 'novice' | 'standalone' = 'novice' | 'standalone',
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'open' {
    return 'open';
  }

  readonly #menu: ModelMenus<Model>;
  readonly #menuCenter: Point;
  readonly #recognition: MarkingMenuRecognition | undefined;

  declare readonly type: 'open';

  constructor(data: {
    readonly mode: Mode;
    readonly position: StandalonePosition<Mode>;
    readonly source: MarkingMenuEventSource;
    readonly menu: ModelMenus<Model>;
    readonly menuCenter: Point;
    readonly recognition?: MarkingMenuRecognition | undefined;
  }) {
    super(MarkingMenuOpenEvent.type, data);
    this.#menu = data.menu;
    this.#menuCenter = data.menuCenter;
    this.#recognition = data.recognition;
  }

  /**
  The menu that was just opened.
  */
  get menu(): ModelMenus<Model> {
    return this.#menu;
  }

  /**
  The center the opened menu is positioned at.
  */
  get menuCenter(): Point {
    return this.#menuCenter;
  }

  /**
   The recognition that led to this menu, or `undefined` when none ran. Only a
   menu opened from an expert stroke that paused carries one.
   */
  get recognition(): MarkingMenuRecognition | undefined {
    return this.#recognition;
  }
}

/**
 The shared constructor payload of {@link MarkingMenuMoveEvent} and
 {@link MarkingMenuCancelEvent}: both carry the mode, position, active item
 and open menu at a moment where none of those is fixed by the event itself.
 */
type ActiveMenuData<
  Model extends ModelNode = ModelNode,
  Mode extends MarkingMenuMode = MarkingMenuMode,
> = {
  readonly mode: Mode;
  readonly position: StandalonePosition<Mode>;
  readonly source: MarkingMenuEventSource;
  readonly activeItem: ModelItems<Model> | undefined;
  readonly menu: ModelMenus<Model> | undefined;
};

/**
 Dispatched on pointer movement, in every mode. `activeItem` and `menu` are
 always `undefined` in startup and expert, since no menu is open yet for
 anything to be active in.
 */
export class MarkingMenuMoveEvent<
  Model extends ModelNode = ModelNode,
  Mode extends MarkingMenuMode = MarkingMenuMode,
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'move' {
    return 'move';
  }

  readonly #activeItem: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model> | undefined;

  declare readonly type: 'move';

  constructor(data: ActiveMenuData<Model, Mode>) {
    super(MarkingMenuMoveEvent.type, data);
    this.#activeItem = data.activeItem;
    this.#menu = data.menu;
  }

  /**
  The item under the pointer, or `undefined` if none is.
  */
  get activeItem(): ModelItems<Model> | undefined {
    return this.#activeItem;
  }

  /**
  The menu currently open, or `undefined` in startup and expert.
  */
  get menu(): ModelMenus<Model> | undefined {
    return this.#menu;
  }
}

/**
 Dispatched in novice and standalone modes whenever the active item changes:
 the only event that carries both the new and the previous active item, so a
 consumer never has to remember the last `move`'s `activeItem` to animate a
 highlight transition.
 */
export class MarkingMenuChangeEvent<
  Model extends ModelNode = ModelNode,
  Mode extends 'novice' | 'standalone' = 'novice' | 'standalone',
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'change' {
    return 'change';
  }

  readonly #activeItem: ModelItems<Model> | undefined;
  readonly #previousActiveItem: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model>;

  declare readonly type: 'change';

  constructor(data: {
    readonly mode: Mode;
    readonly position: StandalonePosition<Mode>;
    readonly source: MarkingMenuEventSource;
    readonly activeItem: ModelItems<Model> | undefined;
    readonly previousActiveItem: ModelItems<Model> | undefined;
    readonly menu: ModelMenus<Model>;
  }) {
    super(MarkingMenuChangeEvent.type, data);
    this.#activeItem = data.activeItem;
    this.#previousActiveItem = data.previousActiveItem;
    this.#menu = data.menu;
  }

  /**
  The item under the pointer after the change, or `undefined` if none is.
  */
  get activeItem(): ModelItems<Model> | undefined {
    return this.#activeItem;
  }

  /**
  The item that was active before this change, or `undefined` if none was.
  */
  get previousActiveItem(): ModelItems<Model> | undefined {
    return this.#previousActiveItem;
  }

  /**
  The menu currently open.
  */
  get menu(): ModelMenus<Model> {
    return this.#menu;
  }
}

/**
 Dispatched once, as the last event of a gesture, when it ends on a leaf.
 `menu` is the menu the leaf was selected from, or `undefined` in expert mode,
 since no menu is open there even though the leaf demonstrably has a parent.
 */
export class MarkingMenuSelectEvent<
  Model extends ModelNode = ModelNode,
  Mode extends MarkingMenuMode = MarkingMenuMode,
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'select' {
    return 'select';
  }

  readonly #selection: ModelLeaves<Model>;
  readonly #menu: ModelMenus<Model> | undefined;
  readonly #recognition: MarkingMenuRecognition | undefined;

  declare readonly type: 'select';

  constructor(data: {
    readonly mode: Mode;
    readonly position: StandalonePosition<Mode>;
    readonly source: MarkingMenuEventSource;
    readonly selection: ModelLeaves<Model>;
    readonly menu: ModelMenus<Model> | undefined;
    readonly recognition?: MarkingMenuRecognition | undefined;
  }) {
    super(MarkingMenuSelectEvent.type, data);
    this.#selection = data.selection;
    this.#menu = data.menu;
    this.#recognition = data.recognition;
  }

  /**
  The leaf that was selected.
  */
  get selection(): ModelLeaves<Model> {
    return this.#selection;
  }

  /**
  The menu the selection was made from, or `undefined` in expert mode.
  */
  get menu(): ModelMenus<Model> | undefined {
    return this.#menu;
  }

  /**
   The recognition that found the selection, or `undefined` when none ran: a
   novice release picks the active item without recognizing anything.
   */
  get recognition(): MarkingMenuRecognition | undefined {
    return this.#recognition;
  }
}

/**
 Dispatched once, as the last event of a gesture, when it ends without a
 selection. `activeItem` is the item that was active at the moment the gesture
 was abandoned: `ModelItems`, not `ModelLeaves`, since it need not be one.
 `undefined` carries the genuine "nothing under the pointer" case.
 */
export class MarkingMenuCancelEvent<
  Model extends ModelNode = ModelNode,
  Mode extends MarkingMenuMode = MarkingMenuMode,
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'cancel' {
    return 'cancel';
  }

  readonly #activeItem: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model> | undefined;
  readonly #reason: MarkingMenuCancelReason<Mode>;
  readonly #recognition: MarkingMenuRecognition | undefined;

  declare readonly type: 'cancel';

  constructor(
    data: ActiveMenuData<Model, Mode> & {
      readonly reason: MarkingMenuCancelReason<Mode>;
      readonly recognition?: MarkingMenuRecognition | undefined;
    },
  ) {
    super(MarkingMenuCancelEvent.type, data);
    this.#activeItem = data.activeItem;
    this.#menu = data.menu;
    this.#reason = data.reason;
    this.#recognition = data.recognition;
  }

  /**
  The item that was active when the gesture was abandoned, or `undefined`.
  */
  get activeItem(): ModelItems<Model> | undefined {
    return this.#activeItem;
  }

  /**
  The menu the gesture was abandoned from, or `undefined` in expert mode.
  */
  get menu(): ModelMenus<Model> | undefined {
    return this.#menu;
  }

  /**
  Why the gesture or menu ended without a selection.
  */
  get reason(): MarkingMenuCancelReason<Mode> {
    return this.#reason;
  }

  /**
   The recognition that found nothing, or `undefined` when none ran: an
   `interrupted` gesture, or a novice release, recognizes nothing.
   */
  get recognition(): MarkingMenuRecognition | undefined {
    return this.#recognition;
  }
}

/* -------------------------------------------------------------------------- *
 * Event map, union, and typed facade
 * -------------------------------------------------------------------------- */

/**
 The closed map from every event name to its exact event class. There is no
 `type: string` fallback: an unknown event name is not a key of this map.
 */
export type MarkingMenuEventMap<Model extends ModelNode = ModelNode> = {
  start: MarkingMenuStartEvent;
  open:
    | MarkingMenuOpenEvent<Model, 'novice'>
    | MarkingMenuOpenEvent<Model, 'standalone'>;
  move: MarkingMenuMoveEvent<Model>;
  change:
    | MarkingMenuChangeEvent<Model, 'novice'>
    | MarkingMenuChangeEvent<Model, 'standalone'>;
  select:
    | MarkingMenuSelectEvent<Model, Exclude<MarkingMenuMode, 'standalone'>>
    | MarkingMenuSelectEvent<Model, 'standalone'>;
  cancel:
    | MarkingMenuCancelEvent<Model, Exclude<MarkingMenuMode, 'standalone'>>
    | MarkingMenuCancelEvent<Model, 'standalone'>;
};

/**
 The union of every event a marking menu dispatches, discriminated on `type`.
 */
export type MarkingMenuEvent<Model extends ModelNode = ModelNode> =
  MarkingMenuEventMap<Model>[keyof MarkingMenuEventMap<Model>];

/**
 The typed, listen-only facade a marking menu controller satisfies. `on`/`off`
 are narrowed to the six known event names: there is no `type: string`
 fallback, so an unknown event name is rejected at the call site.
 */
export type MarkingMenuEventEmitter<Model extends ModelNode = ModelNode> =
  TypedEventEmitter<MarkingMenuEventMap<Model>>;
