import { merge } from 'rxjs';
import {
  debounceTime,
  takeUntil,
  first,
  withLatestFrom,
  last
} from 'rxjs/operators';
import longMoves from './long-move';

/**
 * @param {Observable} drag$ - An observable on drag movements.
 * @param {number} delay - The time (in ms) to wait before considering an absence of movements
 *                         as a dwell.
 * @param {number} [movementsThreshold=0] - The threshold below which movements are considered
 *                                          static.
 * @param {Scheduler} [scheduler] - The scheduler to use for managing the timers that handle the timeout
 * for each value
 * @return {Observable} An observable on dwellings in the movement.
 */
export default (drag$, delay, movementsThreshold = 0, scheduler) =>
  merge(drag$.pipe(first()), longMoves(drag$, movementsThreshold)).pipe(
    // Emit when no long movements happend for delay time.
    debounceTime(delay, scheduler),
    // debounceTime emits the last item when the source observable completes.
    // We don't want that here so we only take until drag is done.
    takeUntil(drag$.pipe(last())),
    // Make sure we do emit the last position.
    withLatestFrom(drag$, (_, last_) => last_)
  );
