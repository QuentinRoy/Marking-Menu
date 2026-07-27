import { scan } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { Point } from '../utils.js';

/**
 Augment a drag$ observable so that events also include the stroke.
 @param drag$ - An observable of drag movements.
 @param options - Configuration options.
 @param options.initStroke - Initial stroke.
 @param options.type - A type to set on every emitted notification.
 @returns An observable on the gesture drawing.
 */
export function draw<T extends { position: Point }>(
  drag$: Observable<T>,
  { initStroke = [], type }: { initStroke?: Point[]; type?: string } = {},
): Observable<T & { stroke: Point[]; type?: string }> {
  const typeOptions = type === undefined ? {} : { type };
  return drag$.pipe(
    scan(
      (acc, notification): T & { stroke: Point[]; type?: string } => ({
        stroke: [...acc.stroke, notification.position],
        ...typeOptions,
        ...notification,
      }),
      // The seed is a partial accumulator; every emitted value combines it
      // with a notification (of type T).
      { stroke: initStroke } as T & { stroke: Point[]; type?: string },
    ),
  );
}
