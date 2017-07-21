import watchDrags from './watch-drag';

/**
 * Transform an observable tracking drags to an observable tracking angle drags.
 * @param {Observable} o Observable tracking drags.
 * @param {List<Number>} center The center of the angular drag. If undefined
 *                              the position of the first notification will be
 *                              used as center.
 */
export const drag$ToAngleDrag$ = (o, center) =>
  o.scan(
    (acc, evt) => {
      const thisCenter = acc.center || evt.position;
      const alpha =
        Math.atan2(
          evt.position[1] - thisCenter[1],
          evt.position[0] - thisCenter[0]
        ) *
        360 /
        (2 * Math.PI);
      return Object.assign({ center: thisCenter, alpha }, evt);
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
export const watchAngleDrags = rootDOM =>
  watchDrags(rootDOM).map(o => drag$ToAngleDrag$(o));
