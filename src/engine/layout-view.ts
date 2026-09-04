import type { AnyModelNode, ModelMenus } from '../types.js';
import type { Point } from '../utils.js';
import type { NavigationState } from './machine.js';

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
): LayoutView<M> {
  switch (state.phase) {
    case 'idle': {
      return {
        cursor: 'default',
        menu: null,
        upperStroke: null,
        lowerStroke: null,
      };
    }

    case 'startup':
    case 'expert': {
      return {
        cursor: 'crosshair',
        menu: null,
        upperStroke: state.stroke,
        lowerStroke: null,
      };
    }

    case 'novice': {
      return {
        cursor: 'none',
        menu: {
          model: state.menu,
          center: state.menuCenter,
          // `ModelItems<M>` is erased to a bare node at the machine's own
          // boundary (see machine.ts's module comment); every real item
          // built by `model.ts` carries `key`, the same reason `renderer.ts`
          // casts `view.menu.model` to `MenuLayoutModel`.
          activeKey:
            (state.active as { readonly key: string } | null)?.key ?? null,
        },
        upperStroke: noviceUpperStroke(state),
        lowerStroke: state.lowerStroke,
      };
    }
  }
}
