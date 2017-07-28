import { dist } from '../utils';

/**
 * Filter out small movements out of a drag observable.
 * @param {Observable} drag$ - An observable on drag movements.
 * @param {number} movementsThreshold - The threshold below which movements are considered
 *                                      static.
 * @return {Observable} An observable only emitting on long enough movements.
 */
export default (drag$, movementsThreshold) =>
  drag$
    // Drop small movements.
    .scan(
      (prev, cur) =>
        !movementsThreshold ||
        dist(prev.position, cur.position) <= movementsThreshold
          ? prev
          : cur
    )
    .distinctUntilChanged()
    .skip(1);
