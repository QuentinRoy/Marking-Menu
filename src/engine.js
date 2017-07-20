import { Observable } from 'rxjs';
/**
 * Create the marking menu controller.
 * @param {{items, get, getNearest}} model
 * @param {Observable} drag$ higher order observable on drag manipulations.
 */
const createEngine = (model, angleDrag$) =>
  angleDrag$.exhaustMap(o_ => {
    const o = o_.share();
    const start$ = o.first().map(e => ({
      type: 'open',
      position: [e.center.clientX, e.center.clientY]
    }));
    const moveAndChange$ = o
      .skip(1)
      .map(e => ({
        alpha: e.alpha,
        position: e.position,
        active: model.getNearest(e.alpha)
      }))
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
