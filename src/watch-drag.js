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
    position: [meanX, meanY]
  };
};

// Create a custom pointer from a mouse event.
const createPEventFromMouseEvent = mouseEvt => ({
  originalEvent: mouseEvt,
  position: [mouseEvt.clientX, mouseEvt.clientY]
});

/**
 * Create an higher order observable that tracks drags.
 * @param {HTMLElement} rootDOM the DOM element to observe pointer events on.
 * @return {Observable}
 */
const watchDrags = rootDOM => {
  // Higher order observable tracking mouse drags.
  const mouseDrags$ = Observable.fromEvent(rootDOM, 'mousedown')
    .map(downEvt => {
      // Make sure we include the first mouse down event.
      const drag$ = Observable.of(downEvt)
        .merge(Observable.fromEvent(rootDOM, 'mousemove'))
        .takeUntil(Observable.fromEvent(rootDOM, 'mouseup'))
        // Publish it as a behavior so that any new subscription will
        // get the last drag position.
        .publishBehavior();
      drag$.connect();
      return drag$;
    })
    .map(o => o.map(createPEventFromMouseEvent));

  // Higher order observable tracking touch drags.
  const touchDrags$ = Observable.fromEvent(rootDOM, 'touchstart')
    // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    .filter(evt => evt.targetTouches.length === 1)
    .map(firstEvent => {
      const drag$ = Observable.fromEvent(rootDOM, 'touchmove')
        .startWith(firstEvent)
        .takeUntil(
          Observable.merge(
            Observable.fromEvent(rootDOM, 'touchend'),
            Observable.fromEvent(rootDOM, 'touchcancel'),
            Observable.fromEvent(rootDOM, 'touchstart')
          ).filter(evt => evt.targetTouches.length !== 1)
        )
        .publishBehavior();
      drag$.connect();
      return drag$;
    })
    .map(o => o.map(createPEventFromTouchEvent));

  // Higher order observable tracking drags.
  return Observable.merge(touchDrags$, mouseDrags$);
};

export default watchDrags;
