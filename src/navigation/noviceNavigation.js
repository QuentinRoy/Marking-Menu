import { Observable } from 'rxjs';
import { dist } from '../utils';
import { mapAngleDrag, dwellings } from '../move';

/**
 * @param {Observable} drag$ - An observable of drag movements.
 * @param {MMItem} menu - The model of the menu.
 * @param {object} options - Configuration options.
 * @return {Observable} An observable on the menu navigation events.
 */
const noviceNavigation = (
  drag$,
  menu,
  {
    minSelectionDist,
    minMenuSelectionDist,
    movementsThreshold,
    subMenuOpeningDelay,
    menuCenter
  } = {}
) => {
  // Convert the drag observable to an angular drag observable.
  const angleDrag$ = mapAngleDrag(drag$, menuCenter);

  // Start observable.
  const start$ = Observable.of({
    type: 'open',
    menu,
    center: menuCenter,
    timeStamp: performance ? performance.now() : Date.now()
  });

  // Analyse local movements.
  const moves$ = angleDrag$.skip(1).scan((last, n) => {
    const distFromCenter = dist(n.center, n.position);
    const active =
      distFromCenter < minSelectionDist ? null : menu.getNearestChild(n.alpha);
    const type = !last || last.active === active ? 'move' : 'change';
    return Object.assign({ active, type, distFromCenter }, n);
  }, null);

  // Share this observable as it is used several times
  const startAndMove$ = start$.concat(moves$).share();

  const end$ = startAndMove$
    .startWith({})
    .last()
    .map(n =>
      Object.assign({}, n, {
        type: n.active && n.active.isLeaf() ? 'select' : 'cancel',
        selection: n.active
      })
    );

  // Fully observe the local navigation.
  const localNavigation$ = startAndMove$.merge(end$).share();

  // Look for (sub)menu selection.
  const menuSelection$ =
    // Wait for a pause in the movements.
    dwellings(localNavigation$, subMenuOpeningDelay, movementsThreshold)
      // No menu selections once the local navigation is done.
      .takeUntil(localNavigation$.last())
      // Filter dwellings occurring outside of the selection area.
      .filter(
        n =>
          n.active &&
          n.distFromCenter > minMenuSelectionDist &&
          !n.active.isLeaf()
      );

  // Higher order observable on navigation inside sub-menus.
  const subMenuNavigations$ = menuSelection$.map(n =>
    noviceNavigation(drag$, n.active, {
      minSelectionDist,
      minMenuSelectionDist,
      movementsThreshold,
      subMenuOpeningDelay,
      menuCenter: n.position
    })
  );

  // Start with local navigation but switch to the first sub-menu navigation
  // (if any).
  return subMenuNavigations$
    .take(1)
    .startWith(localNavigation$)
    .switch();
};

export default noviceNavigation;
