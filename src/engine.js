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
 * Create the marking menu controller.
 * @param {HTMLElement} parentDOM the element where to listen for events.
 */
const createEngine = parentDOM => {
  // Higher order observable tracking mouse drags.
  const mouseDrag$ = Observable.fromEvent(parentDOM, 'mousedown')
    .map(downEvt =>
      Observable.fromEvent(parentDOM, 'mousemove')
        // Make sure we include the first mouse down event.
        .startWith(downEvt)
        .takeUntil(Observable.fromEvent(parentDOM, 'mouseup'))
    )
    .map(o => o.map(createPEventFromMouseEvent));

  // Higher order observable tracking touch drags.
  const touchDrag$ = Observable.fromEvent(parentDOM, 'touchstart')
    // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    .filter(evt => evt.targetTouches.length === 1)
    .map(firstEvent =>
      Observable.fromEvent(parentDOM, 'touchmove')
        .startWith(firstEvent)
        .takeUntil(
          Observable.merge(
            Observable.fromEvent(parentDOM, 'touchend'),
            Observable.fromEvent(parentDOM, 'touchcancel'),
            Observable.fromEvent(parentDOM, 'touchstart')
          ).filter(evt => evt.targetTouches.length !== 1)
        )
    )
    .map(o => o.map(createPEventFromTouchEvent));

  // Higher order observable tracking drags.
  const drag$ = Observable.merge(touchDrag$, mouseDrag$);

  // Higher order observable tracking angular drags.
  // Emits { center, alpha } where center is the drag start location
  // and alpha is the angle of the center to current drag position vector.
  const angleDrag$ = drag$.map(o =>
    o.scan((acc, evt) => {
      const center = acc
        ? acc.center
        : { clientX: evt.clientX, clientY: evt.clientY };
      const alpha =
        Math.atan2(evt.clientY - center.clientY, evt.clientX - center.clientX) *
        360 /
        (2 * Math.PI);
      return { center, alpha };
    }, null)
  );

  const menuEvent$ = angleDrag$.exhaustMap(o =>
    Observable.concat(
      o.first().map(e => {
        // Adjust the center position
        const parentBCR = parentDOM.getBoundingClientRect();
        const centerX = e.center.clientX - parentBCR.left;
        const centerY = e.center.clientY - parentBCR.top;
        return {
          type: 'open',
          position: [centerX, centerY]
        };
      }),
      o.map(e => ({
        type: 'change',
        alpha: e.alpha
      })),
      Observable.from([{ type: 'close' }])
    )
  );

  return menuEvent$;
};

export default createEngine;
