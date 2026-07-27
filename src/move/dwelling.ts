import { merge, type Observable, type SchedulerLike, debounceTime, takeUntil, first, withLatestFrom, last } from 'rxjs';
import { longMoves, type DragNotification } from './long-move.js';

/**
 Detect dwellings: pauses in a stream of drag movements.

 @param drag$ - An observable on drag movements.
 @param options - Configuration options.
 @param options.delay - The time (in ms) to wait before considering an absence of movements
 as a dwell.
 @param options.movementsThreshold - The threshold below which movements are considered
 static.
 @param options.scheduler - The scheduler to use for managing the timers that handle
 the timeout for each value
 @returns An observable on dwellings in the movement.
 */
export function dwellings<T extends DragNotification>(
  drag$: Observable<T>,
  {
    delay,
    movementsThreshold = 0,
    scheduler,
  }: { delay: number; movementsThreshold?: number; scheduler?: SchedulerLike },
): Observable<T> {
  const dragEnd$ = drag$.pipe(last());
  return merge(drag$.pipe(first()), longMoves(drag$, movementsThreshold)).pipe(
    // Emit when no long movements happend for delay time.
    debounceTime(delay, scheduler),
    // DebounceTime emits the last item when the source observable completes.
    // We don't want that here so we only take until drag is done.
    takeUntil(dragEnd$),
    // Make sure we do emit the last position.
    withLatestFrom(drag$, (_, last_) => last_),
  );
}
