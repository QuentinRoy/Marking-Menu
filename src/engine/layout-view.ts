import type { AnyModelNode, ModelMenus } from '../types.js';
import type { Point } from '../utils.js';
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
      const indicator = {
        anchor: state.origin,
        // The stroke's own tip: it keeps moving with sub-threshold jitter
        // even though startup's dwell (armed on `origin`) never restarts.
        position: state.stroke.at(-1) as Point,
        delayMs: options.noviceDwellingTime,
      };
      return {
        // The cursor is hidden behind the opening indicator, the same way
        // novice mode's own dot already hides it.
        cursor: 'none',
        menu: null,
        upperStroke: state.stroke,
        lowerStroke: null,
        indicator,
      };
    }

    case 'expert': {
      return {
        // The cursor is hidden behind the opening indicator, same as startup.
        cursor: 'none',
        menu: null,
        upperStroke: state.stroke,
        lowerStroke: null,
        indicator: {
          anchor: state.dwellAnchor,
          position: state.stroke.at(-1) as Point,
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
                position: state.lastPosition,
                delayMs: options.submenuOpeningDelay,
              },
      };
    }
  }
}
