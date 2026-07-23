import { merge } from 'rxjs';
import {
  scan,
  startWith,
  share,
  last,
  map,
  filter,
  switchAll,
  take,
} from 'rxjs/operators';
import { toPolar } from '../utils.js';
import { dwellings } from '../move/index.js';

export const noviceMoves = (drag$, menu, { menuCenter, minSelectionDist }) => {
  // Analyse local movements.
  const moves$ = drag$.pipe(
    scan(
      (last_, n) => {
        const { azymuth, radius } = toPolar(n.position, menuCenter);
        const active =
          radius < minSelectionDist ? null : menu.getNearestChild(azymuth);
        const type = last_.active === active ? 'move' : 'change';
        return { active, type, azymuth, radius, ...n };
      },
      { active: null },
    ),
    startWith({
      type: 'open',
      menu,
      center: menuCenter,
      timeStamp: new Event('marking-menu-open').timeStamp,
    }),
    share(),
  );

  const end$ = moves$.pipe(
    startWith({}),
    last(),
    map((n) => ({
      ...n,
      type: n.active && n.active.isLeaf() ? 'select' : 'cancel',
      selection: n.active,
    })),
  );

  return merge(moves$, end$).pipe(share());
};

export const menuSelection = (
  move$,
  { submenuOpeningDelay, movementsThreshold, minMenuSelectionDist },
) =>
  // Wait for a pause in the movements.
  dwellings(move$, {
    delay: submenuOpeningDelay,
    movementsThreshold,
  }).pipe(
    // Filter dwellings occurring outside of the selection area.
    filter(
      (n) => n.active && n.radius > minMenuSelectionDist && !n.active.isLeaf(),
    ),
  );

export const submenuNavigation = (menuSelection$, drag$, subNav, navOptions) =>
  menuSelection$.pipe(
    map((n) =>
      subNav(drag$, n.active, { menuCenter: n.position, ...navOptions }),
    ),
  );

/**
 Navigate the menu in novice mode: highlight items as the pointer approaches them.

 @param {Observable} drag$ - An observable of drag movements.
 @param {MMItem} menu - The model of the menu.
 @param {object} options - Configuration options.
 @param {number} options.minSelectionDist - The minimum distance from the center to select an
 item.
 @param {number} options.minMenuSelectionDist - The minimum distance from the center to open a
 sub-menu.
 @param {number} options.movementsThreshold - The minimum distance between two points to be
 considered a significant movement.
 @param {number} options.submenuOpeningDelay - The dwelling delay before opening a sub-menu.
 @param {number[]} options.menuCenter - The pixel coordinates of the menu's center.
 @param {(drag$: Observable, menu: MMItem, options: object) => Observable} [options.noviceMoves] -
 Override the function that analyses local drag movements.
 @param {(move$: Observable, options: object) => Observable} [options.menuSelection] - Override
 the function that detects (sub)menu selections.
 @param {(menuSelection$: Observable, drag$: Observable, subNav: (...args: unknown[]) =>
 Observable, navOptions: object) => Observable} [options.submenuNavigation] - Override the
 function that creates sub-menu navigation observables.
 @returns {Observable} An observable on the menu navigation events.
 */
export default function noviceNavigation(
  drag$,
  menu,
  {
    minSelectionDist,
    minMenuSelectionDist,
    movementsThreshold,
    submenuOpeningDelay,
    menuCenter,
    noviceMoves: noviceMoves_ = noviceMoves,
    menuSelection: menuSelection_ = menuSelection,
    submenuNavigation: submenuNavigation_ = submenuNavigation,
  },
) {
  // Observe the local navigation.
  const move$ = noviceMoves_(drag$, menu, {
    menuCenter,
    minSelectionDist,
  }).pipe(share());

  // Look for (sub)menu selection.
  const menuSelection$ = menuSelection_(move$, {
    submenuOpeningDelay,
    movementsThreshold,
    minMenuSelectionDist,
  });

  // Higher order observable on navigation inside sub-menus.
  const submenuNavigation$ = submenuNavigation_(
    menuSelection$,
    drag$,
    noviceNavigation,
    {
      minSelectionDist,
      minMenuSelectionDist,
      movementsThreshold,
      submenuOpeningDelay,
      noviceMoves: noviceMoves_,
      menuSelection: menuSelection_,
      submenuNavigation: submenuNavigation_,
    },
  );

  // Start with local navigation but switch to the first sub-menu navigation
  // (if any).
  return submenuNavigation$.pipe(take(1), startWith(move$), switchAll());
}
