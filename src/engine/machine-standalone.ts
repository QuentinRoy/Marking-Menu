import type { Skip } from 'totorobot';
import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  type MarkingMenuEventSource,
} from '../events.js';
import { isModelMenuItem, type ModelLeaf, type ModelNode } from '../types.js';
import { deltaAngle, type Point } from '../utils.js';
import { currentMenu } from './layout-view.js';
import type { MachineStates } from './machine.js';
import type { EngineModelItem, EngineModelMenu } from './model-node.js';

/*
 Standalone mode's rows live in `machine.ts`, inline so totorobot can type
 them; this module holds what they call. `standalone-session.ts` feeds it
 inputs. It is one state because levels and the active
 item are data. See #483.
 */

type StandaloneData = MachineStates['standalone'];

type StandaloneRow = (context: {
  readonly fromData: StandaloneData;
  readonly skip: () => Skip;
}) => StandaloneData | Skip;

/**
 A row jumping the active item to one end of the menu's item order. It
 declines when there is nowhere to go, so a menu with a single item
 announces no change.
 */
export const moveToEnd =
  (end: 'first' | 'last'): StandaloneRow =>
  ({ fromData, skip }) => {
    const { items } = currentMenu(fromData.menus);
    const target = end === 'first' ? items[0] : items.at(-1);
    return target === undefined || target === fromData.active
      ? skip()
      : { ...fromData, active: target };
  };

/**
 The four directions, as the clockwise-from-the-right angles the items are
 laid out on.
 */
const axes = { right: 0, down: 90, left: 180, up: 270 } as const;

export type Direction = keyof typeof axes;

/**
 A row moving the active item toward one of the four directions: among the
 items that are strictly closer to that axis than the active one, the one
 the smallest angular step away. Ties go to the item closer to the axis,
 then to the one clockwise of the active item, so the walk does not depend
 on where the menu's item order happens to start.

 Stepping rather than jumping to the item nearest the axis is what keeps
 every item reachable: a menu of more than four items has directions no
 item sits on, and jumping would only ever land on the four items nearest
 the axes. Being strictly closer is also what ends the walk, so holding a
 direction settles on its axis instead of going round.

 With nothing active yet, there is no step to measure, and the press lands
 on the item nearest the axis instead.
 */
export const moveActiveToward =
  (direction: Direction): StandaloneRow =>
  ({ fromData, skip }) => {
    const menu = currentMenu(fromData.menus);
    const axis = axes[direction];
    const { active } = fromData;
    if (active === undefined) {
      const nearest = menu.getNearestChild(axis);
      return nearest === undefined ? skip() : { ...fromData, active: nearest };
    }

    const activeToAxis = toAxis(active, axis);
    let target: EngineModelItem | undefined;
    for (const item of menu.items) {
      // The active item sits exactly `activeToAxis` away, so this drops it too.
      if (toAxis(item, axis) >= activeToAxis) {
        continue;
      }

      if (
        target === undefined ||
        isCloserStep(item, target, active.angle, axis)
      ) {
        target = item;
      }
    }

    return target === undefined ? skip() : { ...fromData, active: target };
  };

/**
 How far an item lies from an axis, whichever way round.
 */
function toAxis(item: EngineModelItem, axis: number): number {
  return Math.abs(deltaAngle(item.angle, axis));
}

/**
 Whether `item` beats `rival` as the next step from `angle` toward `axis`.
 */
function isCloserStep(
  item: EngineModelItem,
  rival: EngineModelItem,
  angle: number,
  axis: number,
): boolean {
  const step = Math.abs(deltaAngle(angle, item.angle));
  const rivalStep = Math.abs(deltaAngle(angle, rival.angle));
  if (step !== rivalStep) {
    return step < rivalStep;
  }

  const toAxisGap = toAxis(item, axis) - toAxis(rival, axis);
  return toAxisGap === 0 ? deltaAngle(angle, item.angle) > 0 : toAxisGap < 0;
}

/**
 Go down into the active submenu, keeping the center, and land on its first
 item.
 */
export const enterActive: StandaloneRow = ({ fromData, skip }) => {
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
export const leaveLevel: StandaloneRow = ({ fromData, skip }) => {
  const left = currentMenu(fromData.menus);
  return fromData.menus.length < 2 || left.isRoot
    ? skip()
    : { ...fromData, menus: fromData.menus.slice(0, -1), active: left };
};

/**
 Resolve a pointer event's item key against the displayed level, or
 `undefined` when it names none (empty space, or a stale key from a level
 that has since changed).
 */
export function findPointerItem(
  fromData: StandaloneData,
  key: string | undefined,
): EngineModelItem | undefined {
  return key === undefined
    ? undefined
    : currentMenu(fromData.menus).items.find((item) => item.key === key);
}

/**
 A pointer moving over the displayed level: hover, or a held contact
 dragging across it. Always commits, since `move` fires on every pointer
 move regardless of whether the active item it lands on changed.
 */
export const pointerMove = ({
  fromData,
  inputData,
}: {
  readonly fromData: StandaloneData;
  readonly inputData: { readonly itemKey: string | undefined };
}): StandaloneData => ({
  ...fromData,
  active: findPointerItem(fromData, inputData.itemKey),
});

/**
 A held contact interrupted by the platform (`pointercancel`): clears the
 item it activated, the same way leaving it under a hover would, and leaves
 the session open. Declines when nothing was active, since there is then
 nothing to clear.
 */
export const pointerCancel: StandaloneRow = ({ fromData, skip }) =>
  fromData.active === undefined ? skip() : { ...fromData, active: undefined };

/**
 A pointer released while the session stays open: over a submenu item, it
 opens it, keeping the center, with nothing active in the new level yet;
 over an unresolved key, it just clears the active item. Declines a leaf,
 selected by the machine's `-> idle` row for this same input instead.
 */
export const pointerRelease = ({
  fromData,
  inputData,
  skip,
}: {
  readonly fromData: StandaloneData;
  readonly inputData: { readonly itemKey: string | undefined };
  readonly skip: () => Skip;
}): StandaloneData | Skip => {
  const item = findPointerItem(fromData, inputData.itemKey);
  if (item === undefined) {
    return { ...fromData, active: undefined };
  }

  return isModelMenuItem(item)
    ? { ...fromData, menus: [...fromData.menus, item], active: undefined }
    : skip();
};

/**
 The sources of a standalone event that have no pointer position.
 */
export type NonPointerSource = Exclude<
  MarkingMenuEventSource,
  'pointer' | 'gesture'
>;

/**
 What caused a standalone event: the shape of its `source` and `position`.
 A pointer has a position, the other causes have none.
 */
export type StandaloneCause =
  | { readonly source: 'pointer'; readonly position: Point }
  | { readonly source: NonPointerSource; readonly position?: undefined };

/**
 Announce a standalone menu level as displayed.
 */
export function emitStandaloneOpen(
  emit: (name: 'open', data: MarkingMenuOpenEvent) => void,
  { menuCenter, menus }: Pick<StandaloneData, 'menuCenter' | 'menus'>,
  cause: StandaloneCause,
  willAutoFocus: boolean,
): void {
  emit(
    'open',
    new MarkingMenuOpenEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: cause.position,
      source: cause.source,
      menu: currentMenu(menus),
      menuCenter,
      willAutoFocus,
    }),
  );
}

/**
 Announce a standalone active-item change.
 */
export function emitStandaloneChange(
  emit: (name: 'change', data: MarkingMenuChangeEvent) => void,
  {
    cause,
    active,
    previousActive,
    menu,
  }: {
    readonly cause: StandaloneCause;
    readonly active: EngineModelItem | undefined;
    readonly previousActive: EngineModelItem | undefined;
    readonly menu: EngineModelMenu;
  },
): void {
  emit(
    'change',
    new MarkingMenuChangeEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: cause.position,
      source: cause.source,
      activeItem: active,
      previousActiveItem: previousActive,
      menu,
    }),
  );
}

/**
 The action every keyboard-driven standalone→standalone row shares (see
 `machine.ts`'s transition table for the full list: the four directions,
 `first`/`last`, `focus`, entering a submenu, and leaving one): announce
 `open` for a new level, then `change` once the item it lands on differs.
 Not a wildcard action keyed to every standalone→standalone edge, so that
 the standalone pointer's own edges, which can also announce a `move`, carry
 their own actions without this one needing to know to decline them.
 */
export function emitStandaloneMove(
  {
    fromData,
    toData,
    emit,
  }: {
    readonly fromData: StandaloneData;
    readonly toData: StandaloneData;
    readonly emit: {
      (name: 'open', data: MarkingMenuOpenEvent): void;
      (name: 'change', data: MarkingMenuChangeEvent): void;
    };
  },
  cause: StandaloneCause,
): void {
  const menu = currentMenu(toData.menus);
  const isNewLevel = toData.menus.length !== fromData.menus.length;
  if (isNewLevel) {
    // Only the root can skip autofocus: the menu already has focus here.
    emitStandaloneOpen(emit, toData, cause, true);
  }

  if (
    toData.active !== undefined &&
    (isNewLevel || toData.active !== fromData.active)
  ) {
    emitStandaloneChange(emit, {
      cause,
      active: toData.active,
      // A new level starts over: `open` already reset the active item.
      previousActive: isNewLevel ? undefined : fromData.active,
      menu,
    });
  }
}

/**
 Announce that a standalone interaction selected a leaf.
 */
export function emitStandaloneSelect(
  emit: (name: 'select', data: MarkingMenuSelectEvent) => void,
  {
    menus,
    selection,
    cause,
  }: {
    readonly menus: StandaloneData['menus'];
    readonly selection: ModelLeaf;
    readonly cause: StandaloneCause;
  },
): void {
  emit(
    'select',
    new MarkingMenuSelectEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: cause.position,
      source: cause.source,
      selection,
      menu: currentMenu(menus),
    }),
  );
}

/**
 Announce that a standalone interaction ended without a selection.
 */
export function cancelStandalone({
  fromData: { menus, active },
  emit,
  cause,
}: {
  readonly fromData: StandaloneData;
  readonly emit: (name: 'cancel', data: MarkingMenuCancelEvent) => void;
  readonly cause: StandaloneCause;
}): void {
  emit(
    'cancel',
    new MarkingMenuCancelEvent<ModelNode, 'standalone'>({
      mode: 'standalone',
      position: cause.position,
      source: cause.source,
      activeItem: active,
      menu: currentMenu(menus),
      reason: 'dismissed',
    }),
  );
}
