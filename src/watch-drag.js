import { Observable } from 'rxjs';

// Create a custom pointer event from a touch event.
const createPEventFromTouchEvent = touchEvt => {
  const touchList = Array.from(touchEvt.targetTouches);
  const sumX = touchList.reduce((acc, t) => acc + t.clientX, 0);
  const sumY = touchList.reduce((acc, t) => acc + t.clientY, 0);
  const meanX = sumX / touchList.length;
  const meanY = sumY / touchList.length;
  return {
    originalEvent: touchEvt,
    clientX: meanX,
    clientY: meanY
  };
};

// Create a custom pointer from a mouse event.
const createPEventFromMouseEvent = mouseEvt => ({
  originalEvent: mouseEvt,
  clientX: mouseEvt.clientX,
  clientY: mouseEvt.clientY
});

/**
 * Create an higher order observable that tracks drags.
 * @param {HTMLElement} rootDOM the DOM element to observe pointer events on.
 * @return {Observable}
 */
export const watchDrag = rootDOM => {
  // Higher order observable tracking mouse drags.
  const mouseDrag$ = Observable.fromEvent(rootDOM, 'mousedown')
    .map(downEvt =>
      Observable.fromEvent(rootDOM, 'mousemove')
        // Make sure we include the first mouse down event.
        .startWith(downEvt)
        .takeUntil(Observable.fromEvent(rootDOM, 'mouseup'))
    )
    .map(o => o.map(createPEventFromMouseEvent));

  // Higher order observable tracking touch drags.
  const touchDrag$ = Observable.fromEvent(rootDOM, 'touchstart')
    // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    .filter(evt => evt.targetTouches.length === 1)
    .map(firstEvent =>
      Observable.fromEvent(rootDOM, 'touchmove')
        .startWith(firstEvent)
        .takeUntil(
          Observable.merge(
            Observable.fromEvent(rootDOM, 'touchend'),
            Observable.fromEvent(rootDOM, 'touchcancel'),
            Observable.fromEvent(rootDOM, 'touchstart')
          ).filter(evt => evt.targetTouches.length !== 1)
        )
    )
    .map(o => o.map(createPEventFromTouchEvent));

  // Higher order observable tracking drags.
  return Observable.merge(touchDrag$, mouseDrag$);
};

/**
 * Add to a higher order component tracking drags rotations around
 * the start location.
 * @param {Observable} Higher order component tracking drags.
 */
export const mapAngleToDrag = o =>
  o.scan((acc, evt) => {
    const position = { clientX: evt.clientX, clientY: evt.clientY };
    const center = acc ? acc.center : position;
    const alpha =
      Math.atan2(evt.clientY - center.clientY, evt.clientX - center.clientX) *
      360 /
      (2 * Math.PI);
    return {
      center,
      alpha,
      position,
      originalEvent: evt.originalEvent
    };
  }, null);

/**
 * Higher order observable tracking angular drags.
 * Emits { center, alpha, position, originalEvents } where center is the drag
 * start location and alpha is the angle of the center to current drag position
 * vector.
 *
 * @param {HTMLElement} rootDOM the DOM element to observe pointer events on.
 * @return {Observable}
 */
export const watchAngleDrag = rootDOM => watchDrag(rootDOM).map(mapAngleToDrag);
