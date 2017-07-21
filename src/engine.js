import { Observable } from 'rxjs';
import { dist } from './utils';
import { drag$ToAngleDrag$ } from './angle-drag';

/**
 * Create the marking menu controller.
 * @param {{items, get, getNearest}} model
 * @param {Observable} drag$ higher order observable on drag manipulations.
 * @param {Number} minSelectionDist the minimum distance from the center required to
 *                 trigger a selection.
 */
const createEngine = (model, drag$, minSelectionDist) =>
  drag$.map(o => drag$ToAngleDrag$(o)).exhaustMap(o_ => {
    const o = o_.share();
    const start$ = o.first().map(n => Object.assign({ type: 'open' }, n));
    const moveAndChange$ = o
      .skip(1)
      .scan((last, n) => {
        const distFromCenter = dist(n.center, n.position);
        const active =
          distFromCenter < minSelectionDist ? null : model.getNearest(n.alpha);
        const type = last && last.active === n.active ? 'move' : 'change';
        return Object.assign({ active, type }, n);
      }, null)
      .share();
    const end$ = moveAndChange$.startWith({}).last().map(n => ({
      type: n.active ? 'select' : 'cancel',
      selection: n.active
    }));
    return Observable.merge(start$, moveAndChange$, end$);
  });

export default createEngine;
