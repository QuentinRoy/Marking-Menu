import {
  filter,
  last,
  map,
  merge,
  scan,
  share,
  startWith,
  switchAll,
  take,
  type Observable,
} from 'rxjs';
import { dwellings } from '../move/dwelling.js';
import type { MarkingMenuModelItem } from '../types.js';
import { toPolar, type Point } from '../utils.js';
import type { NavigationDrag } from './expert-navigation.js';

/**
 A notification carrying the geometry of a local movement: the item currently
 pointed at (if any), and the polar coordinates of the pointer relative to the
 menu center. It is a drag notification (`D`) augmented with these fields.
 */
type GeometricNotification<D> = D & {
  type: 'move' | 'change' | 'select' | 'cancel';
  active: MarkingMenuModelItem | null;
  azymuth: number;
  radius: number;
  selection?: MarkingMenuModelItem | null | undefined;
};

/**
 A notification describing the menu itself rather than a pointer movement: the
 "open" notification, and the end notifications derived from it (when the drag
 ends without any movement). It never carries pointer geometry.
 */
type MenuNotification = {
  type?: 'open' | 'select' | 'cancel';
  menu?: MarkingMenuModelItem;
  center?: Point;
  timeStamp?: number;
  active?: undefined;
  azymuth?: undefined;
  radius?: undefined;
  selection?: MarkingMenuModelItem | null | undefined;
};

/**
 The notifications flowing through the novice navigation observables.
 */
export type NoviceNotification<D extends NavigationDrag> =
  GeometricNotification<D> | MenuNotification;

/**
 A dwelling that lands on a non-leaf item outside the selection area, i.e. a
 (sub)menu selection. Its `active` item is guaranteed to be set.
 */
type SubmenuSelection<D extends NavigationDrag> = D & {
  type: 'move' | 'change' | 'select' | 'cancel';
  active: MarkingMenuModelItem;
  azymuth: number;
  radius: number;
  selection?: MarkingMenuModelItem | null | undefined;
};

/**
 Analyse the local movements of a drag: emit an "open" notification, then a
 movement notification for each drag position, then an "end" notification.

 @param drag$ - An observable of drag movements.
 @param menu - The model of the menu.
 @param options - Configuration options.
 @param options.menuCenter - The pixel coordinates of the menu's center.
 @param options.minSelectionDist - The minimum distance from the center to
 select an item.
 @returns An observable on the local navigation notifications.
 */
export const noviceMoves = <D extends NavigationDrag>(
  drag$: Observable<D>,
  menu: MarkingMenuModelItem,
  {
    menuCenter,
    minSelectionDist,
  }: { menuCenter: Point; minSelectionDist: number },
): Observable<NoviceNotification<D>> => {
  // Analyse local movements.
  const moves$ = drag$.pipe(
    scan<D, NoviceNotification<D>, { active: null }>(
      (last_, n) => {
        const { azymuth, radius } = toPolar(n.position, menuCenter);
        const active =
          radius < minSelectionDist ? null : menu.getNearestChild(azymuth);
        const type = last_.active === active ? 'move' : 'change';
        return { active, type, azymuth, radius, ...n };
      },
      { active: null },
    ),
    startWith<NoviceNotification<D>>({
      type: 'open',
      menu,
      center: menuCenter,
      timeStamp: new Event('marking-menu-open').timeStamp,
    }),
    share(),
  );

  // `last()` needs a seed in case the source completes empty. It is never
  // actually emitted here (moves$ always starts with the open notification).
  const endSeed: NoviceNotification<D> = {};
  const end$ = moves$.pipe(
    startWith(endSeed),
    last(),
    map((n): NoviceNotification<D> => ({
      ...n,
      type: n.active?.isLeaf ? 'select' : 'cancel',
      selection: n.active,
    })),
  );

  return merge(moves$, end$).pipe(share());
};

/**
 Detect (sub)menu selections: dwellings occurring on a non-leaf item, outside
 the selection area.

 @param move$ - An observable on local navigation notifications.
 @param options - Configuration options.
 @param options.submenuOpeningDelay - The dwelling delay before opening a
 sub-menu.
 @param options.movementsThreshold - The minimum distance between two points to
 be considered a significant movement.
 @param options.minMenuSelectionDist - The minimum distance from the center to
 open a sub-menu.
 @returns An observable on (sub)menu selections.
 */
export const menuSelection = <D extends NavigationDrag>(
  move$: Observable<NoviceNotification<D>>,
  {
    submenuOpeningDelay,
    movementsThreshold,
    minMenuSelectionDist,
  }: {
    submenuOpeningDelay: number;
    movementsThreshold: number;
    minMenuSelectionDist: number;
  },
): Observable<SubmenuSelection<D>> =>
  // Wait for a pause in the movements.
  //
  // `dwellings` is typed for drag notifications, which always carry a
  // `position`. `move$` also carries position-less menu notifications (the
  // "open" notification and the "end" notifications derived from it). Those are
  // re-emitted untouched by `dwellings` and rejected by the filter below, so
  // widening the element type to satisfy `dwellings`' `position` requirement is
  // sound; the only alternative would be to fabricate a position at runtime.
  dwellings(move$ as Observable<NoviceNotification<D> & { position: Point }>, {
    delay: submenuOpeningDelay,
    movementsThreshold,
  }).pipe(
    // Filter dwellings occurring outside of the selection area.
    filter(
      (n): n is SubmenuSelection<D> =>
        // The explicit null/undefined checks (rather than the original
        // truthiness test on `n.active`) narrow `n` to the geometric
        // notification so `radius` and `isLeaf` type-check. `active` is always
        // an object or nullish, so this filters exactly like the original; the
        // behaviour is unchanged.
        n.active !== null &&
        n.active !== undefined &&
        n.radius > minMenuSelectionDist &&
        !n.active.isLeaf,
    ),
  );

/**
 Turn (sub)menu selections into sub-menu navigation observables.

 @param menuSelection$ - An observable on (sub)menu selections.
 @param drag$ - An observable of drag movements.
 @param subNav - The navigation function to use for the sub-menus.
 @param navOptions - The navigation options to forward to `subNav`.
 @returns A higher order observable on sub-menu navigations.
 */
export const submenuNavigation = <D extends NavigationDrag>(
  menuSelection$: Observable<SubmenuSelection<D>>,
  drag$: Observable<D>,
  subNav: NoviceNavigationFn<D>,
  navOptions: SubNavOptions<D>,
): Observable<Observable<NoviceNotification<D>>> =>
  menuSelection$.pipe(
    map((n) =>
      subNav(drag$, n.active, { menuCenter: n.position, ...navOptions }),
    ),
  );

/**
 Configuration options for {@link noviceNavigation}.
 */
export type NoviceNavigationOptions<D extends NavigationDrag> = {
  minSelectionDist: number;
  minMenuSelectionDist: number;
  movementsThreshold: number;
  submenuOpeningDelay: number;
  menuCenter: Point;
  noviceMoves?: NoviceMovesFn<D>;
  menuSelection?: MenuSelectionFn<D>;
  submenuNavigation?: SubmenuNavigationFn<D>;
};

/**
 The options forwarded to a sub-menu navigation: the same options as the parent
 navigation, minus the `menuCenter` which is set per sub-menu.
 */
type SubNavOptions<D extends NavigationDrag> = Omit<
  NoviceNavigationOptions<D>,
  'menuCenter'
>;

/**
 The type of {@link noviceMoves} (and its overrides).
 */
export type NoviceMovesFn<D extends NavigationDrag> = (
  drag$: Observable<D>,
  menu: MarkingMenuModelItem,
  options: { menuCenter: Point; minSelectionDist: number },
) => Observable<NoviceNotification<D>>;

/**
 The type of {@link menuSelection} (and its overrides).
 */
export type MenuSelectionFn<D extends NavigationDrag> = (
  move$: Observable<NoviceNotification<D>>,
  options: {
    submenuOpeningDelay: number;
    movementsThreshold: number;
    minMenuSelectionDist: number;
  },
) => Observable<SubmenuSelection<D>>;

/**
 The type of {@link submenuNavigation} (and its overrides).
 */
export type SubmenuNavigationFn<D extends NavigationDrag> = (
  menuSelection$: Observable<SubmenuSelection<D>>,
  drag$: Observable<D>,
  subNav: NoviceNavigationFn<D>,
  navOptions: SubNavOptions<D>,
) => Observable<Observable<NoviceNotification<D>>>;

/**
 The type of {@link noviceNavigation} (used for its recursive self-reference).
 */
export type NoviceNavigationFn<D extends NavigationDrag> = (
  drag$: Observable<D>,
  menu: MarkingMenuModelItem,
  options: NoviceNavigationOptions<D>,
) => Observable<NoviceNotification<D>>;

/**
 Navigate the menu in novice mode: highlight items as the pointer approaches them.

 @param drag$ - An observable of drag movements.
 @param menu - The model of the menu.
 @param options - Configuration options.
 @param options.minSelectionDist - The minimum distance from the center to
 select an item.
 @param options.minMenuSelectionDist - The minimum distance from the center to
 open a sub-menu.
 @param options.movementsThreshold - The minimum distance between two points to
 be considered a significant movement.
 @param options.submenuOpeningDelay - The dwelling delay before opening a
 sub-menu.
 @param options.menuCenter - The pixel coordinates of the menu's center.
 @param options.noviceMoves - Override the function that analyses local drag
 movements.
 @param options.menuSelection - Override the function that detects (sub)menu
 selections.
 @param options.submenuNavigation - Override the function that creates sub-menu
 navigation observables.
 @returns An observable on the menu navigation events.
 */
export function noviceNavigation<D extends NavigationDrag>(
  drag$: Observable<D>,
  menu: MarkingMenuModelItem,
  {
    minSelectionDist,
    minMenuSelectionDist,
    movementsThreshold,
    submenuOpeningDelay,
    menuCenter,
    noviceMoves: noviceMoves_ = noviceMoves,
    menuSelection: menuSelection_ = menuSelection,
    submenuNavigation: submenuNavigation_ = submenuNavigation,
  }: NoviceNavigationOptions<D>,
): Observable<NoviceNotification<D>> {
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
