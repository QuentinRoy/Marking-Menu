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
  (step: 'first' | 'last'): StandaloneRow =>
  ({ fromData, skip }) => {
    const { items } = currentMenu(fromData.menus);
    const target = step === 'first' ? items[0] : items.at(-1);
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
 then to the first one the menu lists.

 Stepping rather than jumping to the item nearest the axis is what keeps
 every item reachable: a menu of more than four items has directions no
 item sits on, and an absolute mapping would strand the items no axis
 elects. Being strictly closer is also what ends the walk, so holding a
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

    const toAxis = (item: EngineModelItem): number =>
      Math.abs(deltaAngle(item.angle, axis));
    const reach = toAxis(active);
    let target: EngineModelItem | undefined;
    for (const item of menu.items) {
      // The active item is `reach` from the axis, so this excludes it too.
      if (toAxis(item) >= reach) {
        continue;
      }

      if (
        target === undefined ||
        isCloserStep(item, target, active.angle, toAxis)
      ) {
        target = item;
      }
    }

    return target === undefined ? skip() : { ...fromData, active: target };
  };

/**
 Whether `item` beats `rival` as the next step from `angle`.
 */
function isCloserStep(
  item: EngineModelItem,
  rival: EngineModelItem,
  angle: number,
  toAxis: (item: EngineModelItem) => number,
): boolean {
  const step = Math.abs(deltaAngle(angle, item.angle));
  const rivalStep = Math.abs(deltaAngle(angle, rival.angle));
  return step === rivalStep ? toAxis(item) < toAxis(rival) : step < rivalStep;
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
