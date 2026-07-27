import { race, of, type Observable, take, map, skip, startWith, switchAll, mergeMap, exhaustMap } from 'rxjs';
import { longMoves } from '../move/long-move.js';
import { dwellings } from '../move/dwelling.js';
import { draw } from '../move/draw.js';
import { recognizeMarkingMenuStroke as recognize } from '../recognizer/recognize-mm-stroke.js';
import type { MarkingMenuModelItem } from '../types.js';
import type { Point } from '../utils.js';
import { noviceNavigation } from './novice-navigation.js';
import { expertNavigation, type NavigationDrag } from './expert-navigation.js';

/**
 Configuration options threaded through the navigation.
 */
export type NavigationOptions = {
  minSelectionDist: number;
  minMenuSelectionDist: number;
  movementsThreshold: number;
  submenuOpeningDelay: number;
  noviceDwellingTime: number;
};

// `HOO` (higher order observable) is an established suffix of this module's
// public API, imported as-is by the tests; keep it despite strictCamelCase.
// eslint-disable-next-line @typescript-eslint/naming-convention
export const confirmedNoviceNavigationHOO = <D extends NavigationDrag>(
  drag$: Observable<D>,
  start: D | null | undefined,
  model: MarkingMenuModelItem,
  options: NavigationOptions,
) =>
  dwellings(drag$, {
    delay: options.noviceDwellingTime,
    movementsThreshold: options.movementsThreshold,
  }).pipe(
    take(1),
    map(() =>
      (start === null || start === undefined ? drag$ : of(start)).pipe(
        take(1),
        mergeMap((start_) =>
          noviceNavigation(
            // Same as before, skip the first.
            drag$.pipe(skip(1)),
            model,
            { ...options, menuCenter: start_.position },
          ).pipe(map((n) => ({ ...n, mode: 'novice' }))),
        ),
      ),
    ),
  );

// eslint-disable-next-line @typescript-eslint/naming-convention -- see above
export const expertToNoviceSwitchHOO = <D extends NavigationDrag>(
  drag$: Observable<D>,
  model: MarkingMenuModelItem,
  initStroke: Point[],
  options: NavigationOptions,
) =>
  dwellings(draw(drag$, { initStroke }), {
    delay: options.noviceDwellingTime,
    movementsThreshold: options.movementsThreshold,
  }).pipe(
    take(1),
    map((evt) => {
      // Look for the furthest menu (not leaf).
      const menu = recognize(evt.stroke, model, {
        maxDepth: -1,
        requireMenu: true,
      });
      if (!menu || menu.isRoot) {
        return of({ ...evt, type: 'cancel' });
      }

      // Start a novice navigation from there.
      return noviceNavigation(drag$.pipe(skip(1)), menu, {
        ...options,
        menuCenter: evt.position,
      });
    }),
  );

// eslint-disable-next-line @typescript-eslint/naming-convention -- see above
export const confirmedExpertNavigationHOO = <D extends NavigationDrag>(
  drag$: Observable<D>,
  model: MarkingMenuModelItem,
  {
    expertToNoviceSwitchHOO: expertToNoviceSwitchHOO_ = expertToNoviceSwitchHOO,
    ...options
  }: NavigationOptions & {
    expertToNoviceSwitchHOO?: typeof expertToNoviceSwitchHOO;
  },
) =>
  longMoves(draw(drag$, { type: 'draw' }), options.movementsThreshold).pipe(
    take(1),
    map((event_) => {
      const expertNav$ = expertNavigation(
        // Drag always return the last value when observed, in this case we are
        // not interested in it as it has already been took into account.
        drag$.pipe(skip(1)),
        model,
        event_.stroke,
      ).pipe(map((n) => ({ ...n, mode: 'expert' })));
      return expertToNoviceSwitchHOO_(
        drag$,
        model,
        event_.stroke,
        options,
      ).pipe(startWith(expertNav$), switchAll());
    }),
  );

export const startup = <D extends NavigationDrag>(
  drag$: Observable<D>,
  model: MarkingMenuModelItem,
) =>
  expertNavigation(drag$, model).pipe(
    map((n, i) =>
      i === 0
        ? { ...n, type: 'start', mode: 'startup' }
        : { ...n, mode: 'startup' },
    ),
  );

export const navigationFromDrag = <D extends NavigationDrag>(
  drag$: Observable<D>,
  start: D | null | undefined,
  model: MarkingMenuModelItem,
  options: NavigationOptions,
  {
    confirmedExpertNavigationHOO:
      confirmedExpertNavigationHOO_ = confirmedExpertNavigationHOO,
    confirmedNoviceNavigationHOO:
      confirmedNoviceNavigationHOO_ = confirmedNoviceNavigationHOO,
    startup: startup_ = startup,
  }: {
    confirmedExpertNavigationHOO?: typeof confirmedExpertNavigationHOO;
    confirmedNoviceNavigationHOO?: typeof confirmedNoviceNavigationHOO;
    startup?: typeof startup;
  } = {},
) => {
  // Start up observable (while neither expert or novice are confirmed).
  const startUp$ = startup_(drag$, model);

  // Observable on confirmed expert navigation.
  const confirmedExpertNavigation$$ = confirmedExpertNavigationHOO_(
    drag$,
    model,
    options,
  );

  // Observable on confirmed novice navigation.
  const confirmedNoviceNavigation$$ = confirmedNoviceNavigationHOO_(
    drag$,
    start,
    model,
    options,
  );

  // Observable on expert or novice navigation once confirmed.
  const confirmedNavigation$$ = race(
    confirmedExpertNavigation$$,
    confirmedNoviceNavigation$$,
  );

  // Start with startup navigation (similar to expert) but switch to the
  // confirmed navigation as soon as it is settled.
  return confirmedNavigation$$.pipe(startWith(startUp$), switchAll());
};

/**
 Navigate the menu from a higher order observable of drags.

 @param drags$ - A higher order observable on drag movements.
 @param menu - The model of the menu.
 @param options - Configuration options (see {@link ../index.js}).
 @param options.navigationFromDrag - Function to convert a drag observable to a
 navigation observable.
 @returns An observable on the marking menu events.
 */
export function navigation<D extends NavigationDrag>(
  drags$: Observable<Observable<D>>,
  menu: MarkingMenuModelItem,
  {
    navigationFromDrag: navigationFromDrag_ = navigationFromDrag,
    ...options
  }: NavigationOptions & { navigationFromDrag?: typeof navigationFromDrag },
) {
  return drags$.pipe(
    exhaustMap((drag$) =>
      drag$.pipe(
        take(1),
        mergeMap((start) => navigationFromDrag_(drag$, start, menu, options)),
      ),
    ),
  );
}
