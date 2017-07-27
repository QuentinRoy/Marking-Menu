import longMoves from './long-move';

/**
 * @param {Observable} drag$ - An observable on drag movements.
 * @param {number} delay - The time (in ms) to wait before considering an absence of movements
 *                         as a dwell.
 * @param {number} [movementsThreshold=0] - The threshold below which movements are considered
 *                                          static.
 * @return {Observable} An observable on dwellings in the movement.
 */
export default (drag$, delay, movementsThreshold = 0) =>
  longMoves(drag$, movementsThreshold)
    // Emit after a pause in the movements.
    .debounceTime(delay);
