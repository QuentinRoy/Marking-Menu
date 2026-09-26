import type { MenuLayoutModel } from '../layout/menu.js';
import { last, type Point } from '../utils.js';
import type { NavigationOptions, NavigationState } from './machine.js';

/**
 The DOM-free, state-derived layout projection.
 */
export type LayoutView<MenuModel = MenuLayoutModel> = {
  readonly cursor: 'default' | 'crosshair' | 'none';
  readonly menu:
    | undefined
    | {
        readonly model: MenuModel;
        readonly center: Point;
        readonly activeKey: string | undefined;
        // The one item the keyboard can reach with Tab. Only a standalone
        // menu has one: a gesture is driven by the pointer.
        readonly tabStopKey: string | undefined;
        // Whether the menu's own items and wedges accept pointer input
        // directly. Only a standalone menu does: a gesture reads strokes on
        // the surface behind it instead.
        readonly pointerTarget: boolean;
      };
  readonly upperStroke: readonly Point[] | undefined;
  readonly lowerStroke: readonly Point[] | undefined;
  readonly indicator:
    | undefined
    | {
        readonly startedAt: number;
        readonly position: Point;
        readonly delayMs: number;
      };
};

/**
 The segment novice mode draws on top of the open menu: from the menu's
 center to the pointer, never the path the pointer took to get there.
 Startup and expert keep their whole traced stroke instead, which is the
 mark being drawn. The machine stores only `lastPosition` and builds the
 segment here, so the two can never disagree.
 */
export function noviceUpperStroke({
  menuCenter,
  lastPosition,
}: {
  readonly menuCenter: Point;
  readonly lastPosition: Point;
}): readonly [Point, Point] {
  return [menuCenter, lastPosition];
}

/**
 The menu level a standalone interaction is displaying: the last of the
 stack, which always holds at least the root.
 */
export function currentMenu<Menu>(menus: readonly Menu[]): Menu {
  return last(menus);
}

export function projectLayout<
  MenuModel extends MenuLayoutModel,
  Active extends { readonly key: string; readonly isLeaf: boolean },
>(
  state: NavigationState<MenuModel, Active>,
  options: NavigationOptions,
): LayoutView<MenuModel> {
  switch (state.phase) {
    case 'idle': {
      return {
        cursor: 'default',
        menu: undefined,
        upperStroke: undefined,
        lowerStroke: undefined,
        indicator: undefined,
      };
    }

    case 'startup': {
      const indicator = {
        startedAt: state.dwellStartedAt,
        // The stroke's own tip: it keeps moving with sub-threshold jitter
        // even though startup's dwell (armed on `origin`) never restarts.
        position: last(state.stroke),
        delayMs: options.noviceDwellingTime,
      };
      return {
        // The cursor is hidden behind the opening indicator, the same way
        // novice mode's own dot already hides it.
        cursor: 'none',
        menu: undefined,
        upperStroke: state.stroke,
        lowerStroke: undefined,
        indicator,
      };
    }

    case 'expert': {
      return {
        // The cursor is hidden behind the opening indicator, same as startup.
        cursor: 'none',
        menu: undefined,
        upperStroke: state.stroke,
        lowerStroke: undefined,
        indicator: {
          startedAt: state.dwellStartedAt,
          position: last(state.stroke),
          delayMs: options.noviceDwellingTime,
        },
      };
    }

    case 'novice': {
      const { active } = state;
      return {
        cursor: 'none',
        menu: {
          model: state.menu,
          center: state.menuCenter,
          activeKey: active?.key ?? undefined,
          tabStopKey: undefined,
          pointerTarget: false,
        },
        upperStroke: noviceUpperStroke(state),
        lowerStroke: state.lowerStroke,
        indicator:
          active === undefined || active.isLeaf
            ? undefined
            : {
                startedAt: state.dwellStartedAt,
                position: state.lastPosition,
                delayMs: options.submenuOpeningDelay,
              },
      };
    }

    case 'standalone': {
      const menu = currentMenu(state.menus);
      const activeKey = state.active?.key;
      return {
        cursor: 'default',
        menu: {
          model: menu,
          center: state.menuCenter,
          activeKey,
          // With nothing active yet, Tab lands on the first item.
          tabStopKey: activeKey ?? menu.items[0]?.key,
          pointerTarget: true,
        },
        upperStroke: undefined,
        lowerStroke: undefined,
        indicator: undefined,
      };
    }
  }
}
