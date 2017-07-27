import rad2deg from 'rad2deg';
import watchDrags from './linear-drag';

/**
 * @param {Observable} $drag Observable tracking drags.
 * @param {List<Number>} center The center of the angular drag. If undefined
 *                              the position of the first notification will be
 *                              used as center.
 * @return {Observable} An observable tracking angle drags built from `o`.
 */
export const drag$ToAngleDrag$ = ($drag, center) =>
  $drag.scan(
    (acc, evt) => {
      const thisCenter = acc.center || evt.position;
      const alpha = rad2deg(
        Math.atan2(
          evt.position[1] - thisCenter[1],
          evt.position[0] - thisCenter[0]
        )
      );
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
 * @return {Observable} An observable tracking angle drags.
 */
export const watchAngleDrags = rootDOM =>
  watchDrags(rootDOM).map(o => drag$ToAngleDrag$(o));
