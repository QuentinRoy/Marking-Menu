import {
  BehaviorSubject,
  connectable,
  filter,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  takeUntil,
  type Observable,
} from 'rxjs';
import {
  createPointerEventFromMouseEvent,
  createPointerEventFromTouchEvent,
  type PointerNotification,
} from './pointer-events.js';

// `fromEvent` infers `Event` for HTMLElement targets; narrow it to the actual
// event type (its deprecated explicit type parameter would do the same).
const fromDomEvent = <E extends Event>(
  target: HTMLElement,
  eventName: string,
): Observable<E> => fromEvent(target, eventName) as Observable<E>;

// Higher order observable tracking mouse drags.
export const mouseDrags = (
  rootDOM: HTMLElement,
): Observable<Observable<PointerNotification<MouseEvent>>> =>
  fromDomEvent<MouseEvent>(rootDOM, 'mousedown').pipe(
    map((downEvt) => {
      // Make sure we include the first mouse down event.
      const dragEvents$ = merge(
        of(downEvt),
        fromDomEvent<MouseEvent>(rootDOM, 'mousemove'),
      ).pipe(takeUntil(fromEvent(rootDOM, 'mouseup')));
      // Publish it as a behavior so that any new subscription will
      // get the last drag position.
      const drag$ = connectable(dragEvents$, {
        connector: () => new BehaviorSubject(downEvt),
        resetOnDisconnect: false,
      });
      drag$.connect();
      return drag$;
    }),
    map((o) => o.pipe(map(createPointerEventFromMouseEvent))),
  );

// Higher order observable tracking touch drags.
export const touchDrags = (
  rootDOM: HTMLElement,
): Observable<Observable<PointerNotification<TouchEvent>>> =>
  fromDomEvent<TouchEvent>(rootDOM, 'touchstart').pipe(
    // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    filter((evt) => evt.targetTouches.length === 1),
    map((firstEvent) => {
      const touchEnd$ = merge(
        fromDomEvent<TouchEvent>(rootDOM, 'touchend'),
        fromDomEvent<TouchEvent>(rootDOM, 'touchcancel'),
        fromDomEvent<TouchEvent>(rootDOM, 'touchstart'),
      ).pipe(filter((evt) => evt.targetTouches.length !== 1));
      const dragEvents$ = fromDomEvent<TouchEvent>(rootDOM, 'touchmove').pipe(
        startWith(firstEvent),
        takeUntil(touchEnd$),
      );
      const drag$ = connectable(dragEvents$, {
        connector: () => new BehaviorSubject(firstEvent),
        resetOnDisconnect: false,
      });
      // FIXME: the line below retains the subscription until next touch end.
      drag$.connect();
      return drag$;
    }),
    map((o) => o.pipe(map(createPointerEventFromTouchEvent))),
  );

/**
 Any drag notification produced by the default `watchDrags` factories.
 */
export type DefaultDragNotification = PointerNotification<
  TouchEvent | MouseEvent
>;

/**
 Observe drags (mouse and touch) on a DOM element.

 @param rootDOM - the DOM element to observe pointer events on.
 @param options - Configuration options.
 @param options.dragObsFactories - factories to use to observe drags.
 @returns A higher order observable that drag observables. The sub-observables are
 published as behaviors so that any new subscription immediately get the last
 position.
 */
export function watchDrags<T>(
  rootDOM: HTMLElement,
  options: { dragObsFactories: Array<(root: HTMLElement) => Observable<T>> },
): Observable<T>;
export function watchDrags(
  rootDOM: HTMLElement,
  options?: {
    dragObsFactories?: Array<
      (root: HTMLElement) => Observable<Observable<DefaultDragNotification>>
    >;
  },
): Observable<Observable<DefaultDragNotification>>;
export function watchDrags(
  rootDOM: HTMLElement,
  {
    dragObsFactories = [touchDrags, mouseDrags],
  }: {
    dragObsFactories?: Array<(root: HTMLElement) => Observable<unknown>>;
  } = {},
): Observable<unknown> {
  return merge(...dragObsFactories.map((f) => f(rootDOM)));
}
