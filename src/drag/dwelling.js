import { dist } from '../utils';

/**
 * @param {Observable} drag$ - An observable on drag movements.
 * @param {number} delay - The time (in ms) to wait before considering an absence of movements
 *                         as a dwell.
 * @param {number} [movementsThreshold=0] - The threshold below which movements are considered
 *                                          static.
 * @return {Observable} An observable on dwellings in the movement.
 */
export default (drag$, delay, movementsThreshold = 0) =>
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
    // Emit after a pause in the movements.
    .debounceTime(delay);
