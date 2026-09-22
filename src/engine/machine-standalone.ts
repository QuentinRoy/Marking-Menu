import type { Skip } from 'totorobot';
import { MarkingMenuCancelEvent, MarkingMenuOpenEvent } from '../events.js';
import { isModelMenuItem, type ModelNode } from '../types.js';
import { deltaAngle } from '../utils.js';
import { currentMenu } from './layout-view.js';
import type { MachineStates } from './machine.js';
import type { EngineModelItem } from './model-node.js';

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
 Announce a standalone menu level as displayed.
 */
export function emitStandaloneOpen(
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
export function cancelStandalone({
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
      reason: 'dismissed',
    }),
  );
}
