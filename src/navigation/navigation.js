import { race, of } from 'rxjs';
import {
  take,
  map,
  skip,
  startWith,
  switchAll,
  mergeMap,
  exhaustMap,
} from 'rxjs/operators';
import { longMoves, dwellings, draw } from '../move/index.js';
import recognize from '../recognizer/index.js';
import noviceNavigation from './novice-navigation.js';
import expertNavigation from './expert-navigation.js';

export const confirmedNoviceNavigationHOO = (drag$, start, model, options) =>
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

export const expertToNoviceSwitchHOO = (drag$, model, initStroke, options) =>
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
      if (!menu || menu.isRoot()) {
        return of({ ...evt, type: 'cancel' });
      }

      // Start a novice navigation from there.
      return noviceNavigation(drag$.pipe(skip(1)), menu, {
        ...options,
        menuCenter: evt.position,
      });
    }),
  );

export const confirmedExpertNavigationHOO = (
  drag$,
  model,
  {
    expertToNoviceSwitchHOO: expertToNoviceSwitchHOO_ = expertToNoviceSwitchHOO,
    ...options
  } = {},
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

export const startup = (drag$, model) =>
  expertNavigation(drag$, model).pipe(
    map((n, i) =>
      i === 0
        ? { ...n, type: 'start', mode: 'startup' }
        : { ...n, mode: 'startup' },
    ),
  );

export const navigationFromDrag = (
  drag$,
  start,
  model,
  options,
  {
    confirmedExpertNavigationHOO:
      confirmedExpertNavigationHOO_ = confirmedExpertNavigationHOO,
    confirmedNoviceNavigationHOO:
      confirmedNoviceNavigationHOO_ = confirmedNoviceNavigationHOO,
    startup: startup_ = startup,
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

 @param {Observable} drags$ - A higher order observable on drag movements.
 @param {MMItem} menu - The model of the menu.
 @param {object} options - Configuration options (see {@link ../index.js}).
 @param {(drag$: Observable, start: object, model: MMItem, options: object) => Observable}
 [options.navigationFromDrag=navigationFromDrag] - Function to convert a drags higher order
 observable to a navigation observable.
 @returns {Observable} An observable on the marking menu events.
 */
export default function navigation(
  drags$,
  menu,
  { navigationFromDrag: navigationFromDrag_ = navigationFromDrag, ...options },
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
