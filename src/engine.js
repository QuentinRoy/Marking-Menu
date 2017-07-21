import { Observable } from 'rxjs';
import { dist } from './utils';

/**
 * Create the marking menu controller.
 * @param {{items, get, getNearest}} model
 * @param {Observable} drag$ higher order observable on drag manipulations.
 * @param {Number} minSelectionDist the minimum distance from the center required to
 *                 trigger a selection.
 */
const createEngine = (model, angleDrag$, minSelectionDist) =>
  angleDrag$.exhaustMap(o_ => {
    const o = o_.share();
    const start$ = o.first().map(e => ({
      type: 'open',
      center: [e.center.clientX, e.center.clientY]
    }));
    const moveAndChange$ = o
      .skip(1)
      .map(e => {
        const center = [e.center.clientX, e.center.clientY];
        const position = [e.position.clientX, e.position.clientY];
        const distFromCenter = dist(center, position);
        const active =
          distFromCenter < minSelectionDist ? null : model.getNearest(e.alpha);
        return {
          center,
          distFromCenter,
          active,
          position,
          alpha: e.alpha
        };
      })
      .scan(
        (last, current) =>
          Object.assign(
            {
              type: last && last.active === current.active ? 'move' : 'change'
            },
            current
          ),
        null
      )
      .share();
    const end$ = moveAndChange$.startWith({}).last().map(e => ({
      type: e.active ? 'select' : 'cancel',
      selection: e.active
    }));
    return Observable.merge(start$, moveAndChange$, end$);
  });

export default createEngine;
