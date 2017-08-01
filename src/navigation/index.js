import { Observable } from 'rxjs';
import noviceNavigation from './noviceNavigation';
import expertNavigation from './expertNavigation';
import { longMoves, dwellings } from '../move';

const navigation = (start, drag$, model, options) => {
  // Start up observable (while neither expert or novice are confirmed).
  const startUp$ = Observable.merge(
    expertNavigation(drag$, model)
      .take(1)
      .map(n => Object.assign(n, { type: 'start' })),
    expertNavigation(drag$, model).skip(1)
  ).map(n => Object.assign(n, { mode: 'startup' }));

  // Observable on confirmed expert navigation.
  const confirmedExpertNavigation$$ = longMoves(
    expertNavigation(drag$, model),
    options.movementsThreshold
  )
    .take(1)
    .map(e =>
      expertNavigation(drag$, model, e.stroke).map(n =>
        Object.assign(n, { mode: 'expert' })
      )
    );

  // Observable on confirmed novice navigation.
  const confirmedNoviceNavigation$$ = dwellings(
    drag$,
    options.noviceDwellingTime,
    options.movementsThreshold
  )
    .take(1)
    .map(() =>
      noviceNavigation(
        drag$,
        model,
        Object.assign(options, { menuCenter: start.center })
      ).map(n => Object.assign(n, { mode: 'novice' }))
    );

  // Observable on expert or novice navigation once confirmed.
  const confirmedNavigation$$ = Observable.race(
    confirmedExpertNavigation$$,
    confirmedNoviceNavigation$$
  );

  // Start with expert navigation but switch to the confirmed navigation as soon as it is
  // settled.
  return confirmedNavigation$$.startWith(startUp$).switch();
};

/**
 * @param {Observable} drags$ - A higher order observable on drag movements.
 * @param {MenuItem} menu - The model of the menu.
 * @param {object} options - Configuration options (see {@link ../index.js}).
 * @return {Observable} An observable on the marking menu events.
 */
export default (drags$, ...navArgs) =>
  drags$.exhaustMap(drag$ =>
    drag$.take(1).mergeMap(start => navigation(start, drag$, ...navArgs))
  );
