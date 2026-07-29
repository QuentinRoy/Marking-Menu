import type { Point } from '../utils.js';
import type { NavigationState } from './machine.js';

/**
 The DOM-free, state-derived layout projection. `menu` and `lowerStroke` are
 always `null` until a ticket introduces the `novice` phase.
 */
export type LayoutView = {
  readonly cursor: 'default' | 'crosshair' | 'none';
  readonly menu: null;
  readonly upperStroke: readonly Point[] | null;
  readonly lowerStroke: null;
};

export function projectLayout(state: NavigationState): LayoutView {
  if (state.phase === 'idle') {
    return {
      cursor: 'default',
      menu: null,
      upperStroke: null,
      lowerStroke: null,
    };
  }

  return {
    cursor: 'crosshair',
    menu: null,
    upperStroke: state.stroke,
    lowerStroke: null,
  };
}
