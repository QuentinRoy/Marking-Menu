import type { TypedEventEmitter } from './typed-event-emitter.js';
import type {
  AnyModelNode,
  ModelItems,
  ModelLeaves,
  ModelMenus,
} from './types.js';
import type { Point } from './utils.js';

/*
 The public event contract: the events {@link createMarkingMenu}'s controller
 dispatches, and the typed facade it dispatches them through.
 */

/* -------------------------------------------------------------------------- *
 * Shared payload types
 * -------------------------------------------------------------------------- */

/** The navigation mode a gesture is in when an event is dispatched. */
export type MarkingMenuMode = 'startup' | 'novice' | 'expert';

/**
 A 2D point, as carried by event payloads.

 The public name for the library's internal {@link Point}, which is readonly
 for exactly this reason.
 */
export type ReadonlyPoint = Point;

/* -------------------------------------------------------------------------- *
 * Event classes
 * -------------------------------------------------------------------------- */

/**
 What every marking menu event has in common: the mode the gesture was in, and
 the pointer position, both at dispatch time.

 Not a DOM `Event`: this library has no DOM target, no bubbling, and no
 default action to prevent, so `Event`'s machinery would all be dead weight.
 */
export abstract class MarkingMenuEventBase {
  readonly #mode: MarkingMenuMode;
  readonly #position: ReadonlyPoint;
  readonly type: string;

  constructor(
    type: string,
    data: { readonly mode: MarkingMenuMode; readonly position: ReadonlyPoint },
  ) {
    this.type = type;
    this.#mode = data.mode;
    this.#position = data.position;
  }

  /** The navigation mode the gesture was in when this event was dispatched. */
  get mode(): MarkingMenuMode {
    return this.#mode;
  }

  /** The pointer position at the time this event was dispatched. */
  get position(): ReadonlyPoint {
    return this.#position;
  }
}

/**
 Dispatched once, as the first event of a gesture, when a primary pointer goes
 down.
 */
export class MarkingMenuStartEvent extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'start' {
    return 'start';
  }

  declare readonly type: 'start';

  constructor(data: { readonly position: ReadonlyPoint }) {
    super(MarkingMenuStartEvent.type, {
      mode: 'startup',
      position: data.position,
    });
  }

  override get mode(): 'startup' {
    return 'startup';
  }
}

/**
 Dispatched once per gesture, when novice mode opens a menu: the dwell that
 starts novice mode, or a submenu dwell while already in novice mode.
 */
export class MarkingMenuOpenEvent<
  M extends AnyModelNode,
> extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'open' {
    return 'open';
  }

  readonly #menu: ModelMenus<M>;
  readonly #menuCenter: ReadonlyPoint;

  declare readonly type: 'open';

  constructor(data: {
    readonly position: ReadonlyPoint;
    readonly menu: ModelMenus<M>;
    readonly menuCenter: ReadonlyPoint;
  }) {
    super(MarkingMenuOpenEvent.type, {
      mode: 'novice',
      position: data.position,
    });
    this.#menu = data.menu;
    this.#menuCenter = data.menuCenter;
  }

  override get mode(): 'novice' {
    return 'novice';
  }

  /** The menu that was just opened. */
  get menu(): ModelMenus<M> {
    return this.#menu;
  }

  /** The center the opened menu is positioned at. */
  get menuCenter(): ReadonlyPoint {
    return this.#menuCenter;
  }
}

/**
 The shared constructor payload of {@link MarkingMenuMoveEvent} and
 {@link MarkingMenuCancelEvent}: both carry the mode, position, active item
 and open menu at a moment where none of those is fixed by the event itself.
 */
type ActiveMenuData<M extends AnyModelNode> = {
  readonly mode: MarkingMenuMode;
  readonly position: ReadonlyPoint;
  readonly active: ModelItems<M> | null;
  readonly menu: ModelMenus<M> | null;
};

/**
 Dispatched on pointer movement, in every mode. `active` and `menu` are always
 `null` in startup and expert, since no menu is open yet for anything to be
 active in.
 */
export class MarkingMenuMoveEvent<
  M extends AnyModelNode,
> extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'move' {
    return 'move';
  }

  readonly #active: ModelItems<M> | null;
  readonly #menu: ModelMenus<M> | null;

  declare readonly type: 'move';

  constructor(data: ActiveMenuData<M>) {
    super(MarkingMenuMoveEvent.type, {
      mode: data.mode,
      position: data.position,
    });
    this.#active = data.active;
    this.#menu = data.menu;
  }

  /** The item under the pointer, or `null` if none is. */
  get active(): ModelItems<M> | null {
    return this.#active;
  }

  /** The menu currently open, or `null` in startup and expert. */
  get menu(): ModelMenus<M> | null {
    return this.#menu;
  }
}

/**
 Dispatched in novice mode whenever the active item changes: the only event
 that carries both the new and the previous active item, so a consumer never
 has to remember the last `move`'s `active` to animate a highlight
 transition.
 */
export class MarkingMenuChangeEvent<
  M extends AnyModelNode,
> extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'change' {
    return 'change';
  }

  readonly #active: ModelItems<M> | null;
  readonly #previousActive: ModelItems<M> | null;
  readonly #menu: ModelMenus<M>;

  declare readonly type: 'change';

  constructor(data: {
    readonly position: ReadonlyPoint;
    readonly active: ModelItems<M> | null;
    readonly previousActive: ModelItems<M> | null;
    readonly menu: ModelMenus<M>;
  }) {
    super(MarkingMenuChangeEvent.type, {
      mode: 'novice',
      position: data.position,
    });
    this.#active = data.active;
    this.#previousActive = data.previousActive;
    this.#menu = data.menu;
  }

  override get mode(): 'novice' {
    return 'novice';
  }

  /** The item under the pointer after the change, or `null` if none is. */
  get active(): ModelItems<M> | null {
    return this.#active;
  }

  /** The item that was active before this change, or `null` if none was. */
  get previousActive(): ModelItems<M> | null {
    return this.#previousActive;
  }

  /** The menu currently open. */
  get menu(): ModelMenus<M> {
    return this.#menu;
  }
}

/**
 Dispatched once, as the last event of a gesture, when it ends on a leaf.
 `menu` is the menu the leaf was selected from, or `null` in expert mode,
 since no menu is open there even though the leaf demonstrably has a parent.
 */
export class MarkingMenuSelectEvent<
  M extends AnyModelNode,
> extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'select' {
    return 'select';
  }

  readonly #selection: ModelLeaves<M>;
  readonly #menu: ModelMenus<M> | null;

  declare readonly type: 'select';

  constructor(data: {
    readonly mode: MarkingMenuMode;
    readonly position: ReadonlyPoint;
    readonly selection: ModelLeaves<M>;
    readonly menu: ModelMenus<M> | null;
  }) {
    super(MarkingMenuSelectEvent.type, {
      mode: data.mode,
      position: data.position,
    });
    this.#selection = data.selection;
    this.#menu = data.menu;
  }

  /** The leaf that was selected. */
  get selection(): ModelLeaves<M> {
    return this.#selection;
  }

  /** The menu the selection was made from, or `null` in expert mode. */
  get menu(): ModelMenus<M> | null {
    return this.#menu;
  }
}

/**
 Dispatched once, as the last event of a gesture, when it ends without a
 selection. `active` is the item that was active at the moment the gesture
 was abandoned: `ModelItems`, not `ModelLeaves`, since it need not be one.
 `null` carries the genuine "nothing under the pointer" case.
 */
export class MarkingMenuCancelEvent<
  M extends AnyModelNode,
> extends MarkingMenuEventBase {
  /** This event's type, as a literal. */
  static get type(): 'cancel' {
    return 'cancel';
  }

  readonly #active: ModelItems<M> | null;
  readonly #menu: ModelMenus<M> | null;

  declare readonly type: 'cancel';

  constructor(data: ActiveMenuData<M>) {
    super(MarkingMenuCancelEvent.type, {
      mode: data.mode,
      position: data.position,
    });
    this.#active = data.active;
    this.#menu = data.menu;
  }

  /** The item that was active when the gesture was abandoned, or `null`. */
  get active(): ModelItems<M> | null {
    return this.#active;
  }

  /** The menu the gesture was abandoned from, or `null` in expert mode. */
  get menu(): ModelMenus<M> | null {
    return this.#menu;
  }
}

/* -------------------------------------------------------------------------- *
 * Event map, union, and typed facade
 * -------------------------------------------------------------------------- */

/**
 The closed map from every event name to its exact event class. There is no
 `type: string` fallback: an unknown event name is not a key of this map.
 */
export type MarkingMenuEventMap<M extends AnyModelNode> = {
  start: MarkingMenuStartEvent;
  open: MarkingMenuOpenEvent<M>;
  move: MarkingMenuMoveEvent<M>;
  change: MarkingMenuChangeEvent<M>;
  select: MarkingMenuSelectEvent<M>;
  cancel: MarkingMenuCancelEvent<M>;
};

/**
 The union of every event a marking menu dispatches, discriminated on `type`.
 */
export type MarkingMenuEvent<M extends AnyModelNode> =
  MarkingMenuEventMap<M>[keyof MarkingMenuEventMap<M>];

/**
 The typed, listen-only facade a marking menu controller satisfies. `on`/`off`
 are narrowed to the six known event names: there is no `type: string`
 fallback, so an unknown event name is rejected at the call site.
 */
export type MarkingMenuEventEmitter<M extends AnyModelNode> = TypedEventEmitter<
  MarkingMenuEventMap<M>
>;
