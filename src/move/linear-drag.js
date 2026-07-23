import { fromEvent, of, merge } from 'rxjs';
import {
  map,
  takeUntil,
  publishBehavior,
  filter,
  startWith,
} from 'rxjs/operators';
import {
  createPEventFromMouseEvent,
  createPEventFromTouchEvent,
} from './pointer-events.js';

// Higher order observable tracking mouse drags.
export const mouseDrags = (rootDOM) =>
  fromEvent(rootDOM, 'mousedown').pipe(
    map((downEvt) => {
      // Make sure we include the first mouse down event.
      const drag$ = merge(of(downEvt), fromEvent(rootDOM, 'mousemove')).pipe(
        takeUntil(fromEvent(rootDOM, 'mouseup')),
        // Publish it as a behavior so that any new subscription will
        // get the last drag position.
        publishBehavior(),
      );
      drag$.connect();
      return drag$;
    }),
    map((o) => o.pipe(map((...args) => createPEventFromMouseEvent(...args)))),
  );

// Higher order observable tracking touch drags.
export const touchDrags = (rootDOM) =>
  fromEvent(rootDOM, 'touchstart').pipe(
    // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    filter((evt) => evt.targetTouches.length === 1),
    map((firstEvent) => {
      const touchEnd$ = merge(
        fromEvent(rootDOM, 'touchend'),
        fromEvent(rootDOM, 'touchcancel'),
        fromEvent(rootDOM, 'touchstart'),
      ).pipe(filter((evt) => evt.targetTouches.length !== 1));
      const drag$ = fromEvent(rootDOM, 'touchmove').pipe(
        startWith(firstEvent),
        takeUntil(touchEnd$),
        publishBehavior(),
      );
      // FIXME: the line below retains the subscription until next touch end.
      drag$.connect();
      return drag$;
    }),
    map((o) => o.pipe(map(createPEventFromTouchEvent))),
  );

/**
 Observe drags (mouse and touch) on a DOM element.

 @param {HTMLElement} rootDOM - the DOM element to observe pointer events on.
 @param {Array<(rootDOM: HTMLElement) => Observable>} [dragObsFactories] - factory to use to
 observe drags.
 @returns {Observable} A higher order observable that drag observables. The sub-observables are
 published as behaviors so that any new subscription immediately get the last
 position.
 */
export default function watchDrags(
  rootDOM,
  dragObsFactories = [touchDrags, mouseDrags],
) {
  return merge(...dragObsFactories.map((f) => f(rootDOM)));
}
