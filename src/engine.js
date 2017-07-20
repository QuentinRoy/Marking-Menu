import { Observable } from 'rxjs';
/**
 * Create the marking menu controller.
 * @param {Observable} drag$ higher order observable on drag manipulation.
 */
const createEngine = angleDrag$ =>
  angleDrag$.exhaustMap(o =>
    Observable.concat(
      o.first().map(e => ({
        type: 'open',
        position: [e.center.clientX, e.center.clientY]
      })),
      o.map(e => ({
        type: 'move',
        alpha: e.alpha
      })),
      Observable.from([{ type: 'close' }])
    )
  );

export default createEngine;
