import type { Skip } from 'totorobot';
import { MarkingMenuCancelEvent, MarkingMenuOpenEvent } from '../events.js';
import { isModelMenuItem, type ModelNode } from '../types.js';
import { currentMenu } from './layout-view.js';
import type { MachineStates } from './machine.js';
import type { EngineModelItem } from './model-node.js';

type StandaloneData = MachineStates['standalone'];

type StandaloneRow = (context: {
  readonly fromData: StandaloneData;
  readonly skip: () => Skip;
}) => StandaloneData | Skip;

/**
 A row moving the active item along the menu's items, which are listed
 clockwise. It declines when there is nowhere to go, so a menu with a single
 item announces no change.
 */
export const moveActive =
  (step: 'next' | 'previous' | 'first' | 'last'): StandaloneRow =>
  ({ fromData, skip }) => {
    const { items } = currentMenu(fromData.menus);
    const index =
      fromData.active === undefined ? -1 : items.indexOf(fromData.active);
    let target: EngineModelItem | undefined;
    switch (step) {
      case 'next': {
        target = items[(index + 1) % items.length];
        break;
      }

      case 'previous': {
        // From nothing, or from the first item, back to the last one.
        target = items[(index <= 0 ? items.length : index) - 1];
        break;
      }

      case 'first': {
        target = items[0];
        break;
      }

      case 'last': {
        target = items.at(-1);
        break;
      }
    }

    return target === undefined || target === fromData.active
      ? skip()
      : { ...fromData, active: target };
  };

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
    }),
  );
}
