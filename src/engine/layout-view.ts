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
        upperStroke: state.upperStroke,
        lowerStroke: state.lowerStroke,
      };
    }
  }
}
