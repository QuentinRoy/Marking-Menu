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
 The mode the menu interaction is in when an event is dispatched: one of the
 stages of a pointer gesture, or `standalone` for a menu opened with the
 controller's `open()` and driven by the keyboard rather than by a gesture.
 */
export type MarkingMenuMode = 'startup' | 'novice' | 'expert' | 'standalone';

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
 and the pointer position, both at dispatch time. `position` is `undefined` in
 standalone mode, where no pointer is involved.

 Not a DOM `Event`: this library has no DOM target, no bubbling, and no
 default action to prevent, so `Event`'s machinery would all be dead weight.
 */
export abstract class MarkingMenuEventBase<
  Mode extends MarkingMenuMode = MarkingMenuMode,
> {
  readonly #mode: Mode;
  readonly #position: Mode extends 'standalone' ? undefined : Point;
  readonly type: string;

  constructor(
    type: string,
    data: {
      readonly mode: Mode;
      readonly position: Mode extends 'standalone' ? undefined : Point;
    },
  ) {
    this.type = type;
    this.#mode = data.mode;
    this.#position = data.position;
  }

  /**
  The mode the interaction was in when this event was dispatched.
  */
  get mode(): Mode {
    return this.#mode;
  }

  /**
   The pointer position at the time this event was dispatched, or `undefined`
   in standalone mode.
   */
  get position(): Mode extends 'standalone' ? undefined : Point {
    return this.#position;
  }
}

/**
 Dispatched once, as the first event of a gesture, when a primary pointer goes
 down.
 */
export class MarkingMenuStartEvent extends MarkingMenuEventBase<'startup'> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'start' {
    return 'start';
  }

  declare readonly type: 'start';

  constructor(data: { readonly position: Point }) {
    super(MarkingMenuStartEvent.type, {
      mode: 'startup',
      position: data.position,
    });
  }
}

/**
 Dispatched when a menu level is displayed: the dwell that starts novice mode,
 a submenu dwell while already in novice mode, or, in standalone mode, the
 root on `open()` and every level entered or left with the keyboard.
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
    readonly position: Mode extends 'standalone' ? undefined : Point;
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
  readonly position: Mode extends 'standalone' ? undefined : Point;
  readonly active: ModelItems<Model> | undefined;
  readonly menu: ModelMenus<Model> | undefined;
};

/**
 Dispatched on pointer movement, in every mode. `active` and `menu` are always
 `undefined` in startup and expert, since no menu is open yet for anything to
 be active in.
 */
export class MarkingMenuMoveEvent<
  Model extends ModelNode = ModelNode,
  Mode extends Exclude<MarkingMenuMode, 'standalone'> = Exclude<
    MarkingMenuMode,
    'standalone'
  >,
> extends MarkingMenuEventBase<Mode> {
  /**
  This event's type, as a literal.
  */
  static get type(): 'move' {
    return 'move';
  }

  readonly #active: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model> | undefined;

  declare readonly type: 'move';

  constructor(data: ActiveMenuData<Model, Mode>) {
    super(MarkingMenuMoveEvent.type, data);
    this.#active = data.active;
    this.#menu = data.menu;
  }

  /**
  The item under the pointer, or `undefined` if none is.
  */
  get active(): ModelItems<Model> | undefined {
    return this.#active;
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
 the only event
 that carries both the new and the previous active item, so a consumer never
 has to remember the last `move`'s `active` to animate a highlight
 transition.
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

  readonly #active: ModelItems<Model> | undefined;
  readonly #previousActive: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model>;

  declare readonly type: 'change';

  constructor(data: {
    readonly mode: Mode;
    readonly position: Mode extends 'standalone' ? undefined : Point;
    readonly active: ModelItems<Model> | undefined;
    readonly previousActive: ModelItems<Model> | undefined;
    readonly menu: ModelMenus<Model>;
  }) {
    super(MarkingMenuChangeEvent.type, data);
    this.#active = data.active;
    this.#previousActive = data.previousActive;
    this.#menu = data.menu;
  }

  /**
  The item under the pointer after the change, or `undefined` if none is.
  */
  get active(): ModelItems<Model> | undefined {
    return this.#active;
  }

  /**
  The item that was active before this change, or `undefined` if none was.
  */
  get previousActive(): ModelItems<Model> | undefined {
    return this.#previousActive;
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
    readonly position: Mode extends 'standalone' ? undefined : Point;
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
 selection. `active` is the item that was active at the moment the gesture
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

  readonly #active: ModelItems<Model> | undefined;
  readonly #menu: ModelMenus<Model> | undefined;
  readonly #recognition: MarkingMenuRecognition | undefined;

  declare readonly type: 'cancel';

  constructor(
    data: ActiveMenuData<Model, Mode> & {
      readonly recognition?: MarkingMenuRecognition | undefined;
    },
  ) {
    super(MarkingMenuCancelEvent.type, data);
    this.#active = data.active;
    this.#menu = data.menu;
    this.#recognition = data.recognition;
  }

  /**
  The item that was active when the gesture was abandoned, or `undefined`.
  */
  get active(): ModelItems<Model> | undefined {
    return this.#active;
  }

  /**
  The menu the gesture was abandoned from, or `undefined` in expert mode.
  */
  get menu(): ModelMenus<Model> | undefined {
    return this.#menu;
  }

  /**
   The recognition that found nothing, or `undefined` when none ran: a
   canceled pointer, or a novice release, recognizes nothing.
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
