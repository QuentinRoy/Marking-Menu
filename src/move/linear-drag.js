import { Observable } from 'rxjs';
import {
  createPEventFromMouseEvent,
  createPEventFromTouchEvent
} from './pointer-events';

// Higher order observable tracking mouse drags.
export const mouseDrags = rootDOM =>
  Observable.fromEvent(rootDOM, 'mousedown')
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
export const touchDrags = rootDOM =>
  Observable.fromEvent(rootDOM, 'touchstart')
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
      // FIXME: the line below retains the subscription until next touch end.
      drag$.connect();
      return drag$;
    })
    .map(o => o.map(createPEventFromTouchEvent));

/**
 * @param {HTMLElement} rootDOM - the DOM element to observe pointer events on.
 * @return {Observable} A higher order observable that drag observables. The sub-observables are
 *                      published as behaviors so that any new subscription immediately get the last
 *                      position.
 */
const watchDrags = rootDOM =>
  Observable.merge(touchDrags(rootDOM), mouseDrags(rootDOM));

export default watchDrags;
