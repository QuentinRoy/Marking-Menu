import { dist } from '../utils';

/**
 * Filter out small movements out of a drag observable.
 * @param {Observable} drag$ - An observable on drag movements.
 * @param {number} movementsThreshold - The threshold below which movements are considered
 *                                      static.
 * @return {Observable} An observable only emitting on long enough movements.
 */
export default (drag$, movementsThreshold = 0) =>
  drag$
    .scan(([prev], cur) => {
      // Initial value.
      if (prev == null) return [cur, false];

      // End of drag can never be a long move. Such events aren't supposed to be
      // emitted by drag observable though.
      if (cur.type === 'end' || cur.type === 'cancel') return [cur, false];

      // If the distance is still below the threshold, re-emit the previous
      // event. It will be filtered-out later, but will come back again as
      // prev on the next scan call.
      if (dist(prev.position, cur.position) < movementsThreshold)
        return [prev, false];

      // Otherwise, emit the new event.
      return [cur, true];
    }, [])
    .filter(([, pass]) => pass)
    .map(x => x[0]);
