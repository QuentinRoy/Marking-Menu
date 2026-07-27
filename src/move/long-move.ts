import { filter, map, scan, type Observable } from 'rxjs';
import { dist } from '../utils.js';

/**
 A drag notification: anything carrying a position and, optionally, a type.
 */
export type DragNotification = {
  position: number[];
  type?: string;
};

/**
 Filter out small movements out of a drag observable.
 @param drag$ - An observable on drag movements.
 @param movementsThreshold - The threshold below which movements are considered
 static.
 @returns An observable only emitting on long enough movements.
 */
export function longMoves<T extends DragNotification>(
  drag$: Observable<T>,
  movementsThreshold = 0,
): Observable<T> {
  return drag$.pipe(
    scan(
      (acc, cur): [T | undefined, boolean] => {
        const [previous] = acc;
        // Initial value.
        if (previous === undefined) {
          return [cur, false];
        }

        // End of drag can never be a long move. Such events aren't supposed to be
        // emitted by drag observable though.
        if (cur.type === 'end' || cur.type === 'cancel') {
          return [cur, false];
        }

        // If the distance is still below the threshold, re-emit the previous
        // event. It will be filtered-out later, but will come back again as
        // prev on the next scan call.
        if (dist(previous.position, cur.position) < movementsThreshold) {
          return [previous, false];
        }

        // Otherwise, emit the new event.
        return [cur, true];
      },
      [undefined, false],
    ),
    filter((state): state is [T, boolean] => state[1]),
    map((x) => x[0]),
  );
}
