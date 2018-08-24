import { race, of, merge } from 'rxjs';
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
import { longMoves, dwellings, draw } from '../move';
import recognize from '../recognizer';

export const confirmedNoviceNavigationHOO = (drag$, start, model, options) =>
  dwellings(drag$, options.noviceDwellingTime, options.movementsThreshold).pipe(
    take(1),
    map(() =>
      (start != null ? of(start) : drag$).pipe(
        take(1),
        mergeMap(start_ =>
          noviceNavigation(
            // Same as before, skip the first.
            drag$.pipe(skip(1)),
            model,
            { ...options, menuCenter: start_.position }
          ).pipe(map(n => ({ ...n, mode: 'novice' })))
        )
      )
    )
  );

export const expertToNoviceSwitchHOO = (drag$, model, initStroke, options) =>
  dwellings(
    draw(drag$, { initStroke }),
    options.noviceDwellingTime,
    options.movementsThreshold
  ).pipe(
    take(1),
    map(evt => {
      // Look for the furthest menu (not leaf).
      const menu = recognize(evt.stroke, model, {
        maxDepth: -1,
        requireMenu: true
      });
      if (menu.isRoot()) {
        return of({ ...evt, type: 'cancel' });
      }
      // Start a novice navigation from there.
      return noviceNavigation(drag$.pipe(skip(1)), menu, {
        ...options,
        menuCenter: evt.position
      });
    })
  );

export const confirmedExpertNavigationHOO = (drag$, model, options) =>
  longMoves(draw(drag$, { type: 'draw' }), options.movementsThreshold).pipe(
    take(1),
    map(e =>
      expertNavigation(
        // Drag always return the last value when observed, in this case we are
        // not interested in it as it has already been took into account.
        drag$.pipe(skip(1)),
        model,
        e.stroke
      ).pipe(map(n => ({ ...n, mode: 'expert' })))
    ),
    map(nav$ =>
      merge(
        of(nav$),
        expertToNoviceSwitchHOO(drag$, model, nav$.stroke, options)
      )
    ),
    switchAll()
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
