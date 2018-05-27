import { race } from 'rxjs';
import {
  take,
  map,
  skip,
  startWith,
  switchAll,
  mergeMap,
  exhaustMap
} from 'rxjs/operators';
import noviceNavigation from './novice-navigation';
import expertNavigation from './expert-navigation';
import { longMoves, dwellings } from '../move';

export const confirmedExpertNavigationHOO = (
  drag$,
  model,
  { movementsThreshold }
) =>
  longMoves(expertNavigation(drag$, model), movementsThreshold).pipe(
    take(1),
    map(e =>
      expertNavigation(
        // Drag always return the last value when observed, in this case we are
        // not interested in it as it has already been took into account.
        drag$.pipe(skip(1)),
        model,
        e.stroke
      ).pipe(map(n => ({ ...n, mode: 'expert' })))
    )
  );

export const confirmedNoviceNavigationHOO = (drag$, start, model, options) =>
  dwellings(drag$, options.noviceDwellingTime, options.movementsThreshold).pipe(
    take(1),
    map(() =>
      noviceNavigation(
        // Same as before, skip the first.
        drag$.pipe(skip(1)),
        model,
        { ...options, menuCenter: start.position }
      ).pipe(map(n => ({ ...n, mode: 'novice' })))
    )
  );

export const startup = (drag$, model) =>
  expertNavigation(drag$, model).pipe(
    map(
      (n, i) =>
        i === 0
          ? { ...n, type: 'start', mode: 'startup' }
          : { ...n, mode: 'startup' }
    )
  );

export const navigationFromDrag = (
  drag$,
  start,
  model,
  options,
  {
    confirmedExpertNavigationHOO: confirmedExpertNavigationHOO_ = confirmedExpertNavigationHOO,
    confirmedNoviceNavigationHOO: confirmedNoviceNavigationHOO_ = confirmedNoviceNavigationHOO,
    startup: startup_ = startup
  } = {}
) => {
  // Start up observable (while neither expert or novice are confirmed).
  const startUp$ = startup_(drag$, model);

  // Observable on confirmed expert navigation.
  const confirmedExpertNavigation$$ = confirmedExpertNavigationHOO_(
    drag$,
    model,
    options
  );

  // Observable on confirmed novice navigation.
  const confirmedNoviceNavigation$$ = confirmedNoviceNavigationHOO_(
    drag$,
    start,
    model,
    options
  );

  // Observable on expert or novice navigation once confirmed.
  const confirmedNavigation$$ = race(
    confirmedExpertNavigation$$,
    confirmedNoviceNavigation$$
  );

  // Start with startup navigation (similar to expert) but switch to the
  // confirmed navigation as soon as it is settled.
  return confirmedNavigation$$.pipe(
    startWith(startUp$),
    switchAll()
  );
};

/**
 * @param {Observable} drags$ - A higher order observable on drag movements.
 * @param {MMItem} menu - The model of the menu.
 * @param {object} options - Configuration options (see {@link ../index.js}).
 * @param {function} [navigationFromDrag_] - function to convert a drags higher
 *                                         order observable to a navigation
 *                                         observable.
 * @return {Observable} An observable on the marking menu events.
 */
export default (
  drags$,
  menu,
  options,
  navigationFromDrag_ = navigationFromDrag
) =>
  drags$.pipe(
    exhaustMap(drag$ =>
      drag$.pipe(
        take(1),
        mergeMap(start => navigationFromDrag_(drag$, start, menu, options))
      )
    )
  );
