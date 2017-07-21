import watchDrag from './watch-drag';

/**
 * Transform an observable tracking drags to an observable tracking angle drags.
 * @param {Observable} o Observable tracking drags.
 * @param {{clientX, clientY}} center The center of the angular drag. If undefined
 *                             the position of the first notification will be
 *                             used as center.
 */
export const drag$ToAngleDrag$ = (o, center) =>
  o.scan(
    (acc, evt) => {
      const position = { clientX: evt.clientX, clientY: evt.clientY };
      const thisCenter = acc.center || position;
      const alpha =
        Math.atan2(
          evt.clientY - thisCenter.clientY,
          evt.clientX - thisCenter.clientX
        ) *
        360 /
        (2 * Math.PI);
      return {
        center: thisCenter,
        alpha,
        position,
        originalEvent: evt.originalEvent
      };
    },
    { center }
  );

/**
 * Higher order observable tracking angular drags.
 * Emits { center, alpha, position, originalEvents } where center is the drag
 * start location and alpha is the angle of the center to current drag position
 * vector.
 *
 * @param {HTMLElement} rootDOM the DOM element to observe pointer events on.
 * @return {Observable}
 */
export const watchAngleDrag = rootDOM =>
  watchDrag(rootDOM).map(o => drag$ToAngleDrag$(o));
