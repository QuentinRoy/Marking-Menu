import { Observable } from 'rxjs';
import { toPolar } from '../utils';
import { dwellings } from '../move';

export const noviceMoves = (drag$, menu, { menuCenter, minSelectionDist }) => {
  // Analyse local movements.
  const moves$ = drag$
    .scan(
      (last, n) => {
        const { azymuth, radius } = toPolar(n.position, menuCenter);
        const active =
          radius < minSelectionDist ? null : menu.getNearestChild(azymuth);
        const type = last.active === active ? 'move' : 'change';
        return { active, type, azymuth, radius, ...n };
      },
      { active: null }
    )
    .startWith({
      type: 'open',
      menu,
      center: menuCenter,
      timeStamp: performance ? performance.now() : Date.now()
    })
    .share();

  const end$ = moves$
    .startWith({})
    .last()
    .map(n => ({
      ...n,
      type: n.active && n.active.isLeaf() ? 'select' : 'cancel',
      selection: n.active
    }));

  return Observable.merge(moves$, end$).share();
};

export const menuSelection = (
  move$,
  { subMenuOpeningDelay, movementsThreshold, minMenuSelectionDist }
) =>
  // Wait for a pause in the movements.
  dwellings(move$, subMenuOpeningDelay, movementsThreshold)
    // Filter dwellings occurring outside of the selection area.
    .filter(
      n => n.active && n.radius > minMenuSelectionDist && !n.active.isLeaf()
    );

export const subMenuNavigation = (menuSelection$, drag$, subNav, navOptions) =>
  menuSelection$.map(n =>
    subNav(drag$, n.active, { menuCenter: n.position, ...navOptions })
  );

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
    menuCenter,
    noviceMoves: noviceMoves_ = noviceMoves,
    menuSelection: menuSelection_ = menuSelection,
    subMenuNavigation: subMenuNavigation_ = subMenuNavigation
  }
) => {
  // Observe the local navigation.
  const move$ = noviceMoves_(drag$, menu, {
    menuCenter,
    minSelectionDist
  }).share();

  // Look for (sub)menu selection.
  const menuSelection$ = menuSelection_(move$, {
    subMenuOpeningDelay,
    movementsThreshold,
    minMenuSelectionDist
  });

  // Higher order observable on navigation inside sub-menus.
  const subMenuNavigation$ = subMenuNavigation_(
    menuSelection$,
    drag$,
    noviceNavigation,
    {
      minSelectionDist,
      minMenuSelectionDist,
      movementsThreshold,
      subMenuOpeningDelay,
      noviceMoves: noviceMoves_,
      menuSelection: menuSelection_,
      subMenuNavigation: subMenuNavigation_
    }
  );

  // Start with local navigation but switch to the first sub-menu navigation
  // (if any).
  return subMenuNavigation$
    .take(1)
    .startWith(move$)
    .switch();
};

export default noviceNavigation;
