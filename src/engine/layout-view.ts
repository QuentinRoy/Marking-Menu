import type { AnyModelNode, ModelMenus } from '../types.js';
import { toPolar, type Point } from '../utils.js';
import type { NavigationOptions, NavigationState } from './machine.js';

/**
 The DOM-free, state-derived layout projection.
 */
export type LayoutView<M extends AnyModelNode> = {
  readonly cursor: 'default' | 'crosshair' | 'none';
  readonly menu: null | {
    readonly model: ModelMenus<M>;
    readonly center: Point;
    readonly activeKey: string | null;
  };
  readonly upperStroke: readonly Point[] | null;
  readonly lowerStroke: readonly Point[] | null;
  readonly indicator: null | {
    readonly anchor: Point;
    readonly alignAngle: number | null;
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
 The angle (degrees) of travel from a stroke's second-to-last point to its
 last one: the opening indicator's align angle while a stroke exists. `null`
 when `stroke` has fewer than two points, so there is no direction yet.
 */
function travelAngle(stroke: readonly Point[]): number | null {
  const to = stroke.at(-1);
  const from = stroke.at(-2);
  return to === undefined || from === undefined
    ? null
    : toPolar(to, from).azymuth;
}

export function projectLayout<M extends AnyModelNode>(
  state: NavigationState<M>,
  options: NavigationOptions,
): LayoutView<M> {
  switch (state.phase) {
    case 'idle': {
      return {
        cursor: 'default',
        menu: null,
        upperStroke: null,
        lowerStroke: null,
        indicator: null,
      };
    }

    case 'startup': {
      return {
        cursor: 'crosshair',
        menu: null,
        upperStroke: state.stroke,
        lowerStroke: null,
        indicator: {
          anchor: state.origin,
          alignAngle: null,
          delayMs: options.noviceDwellingTime,
        },
      };
    }

    case 'expert': {
      return {
        cursor: 'crosshair',
        menu: null,
        upperStroke: state.stroke,
        lowerStroke: null,
        indicator: {
          anchor: state.dwellAnchor,
          alignAngle: travelAngle(state.stroke),
          delayMs: options.noviceDwellingTime,
        },
      };
    }

    case 'novice': {
      // `ModelItems<M>` is erased to a bare node at the machine's own
      // boundary (see machine.ts's module comment); every real item built
      // by `model.ts` carries `key`/`isLeaf`, the same reason `renderer.ts`
      // casts `view.menu.model` to `MenuLayoutModel`.
      const active = state.active as {
        readonly key: string;
        readonly isLeaf: boolean;
      } | null;
      return {
        cursor: 'none',
        menu: {
          model: state.menu,
          center: state.menuCenter,
          activeKey: active?.key ?? null,
        },
        upperStroke: noviceUpperStroke(state),
        lowerStroke: state.lowerStroke,
        indicator:
          active === null || active.isLeaf
            ? null
            : {
                anchor: state.dwellAnchor,
                alignAngle: toPolar(state.lastPosition, state.menuCenter)
                  .azymuth,
                delayMs: options.submenuOpeningDelay,
              },
      };
    }
  }
}
