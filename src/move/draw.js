import { scan } from 'rxjs/operators';

/**
 Augment a drag$ observable so that events also include the stroke.
 @param {Observable} drag$ - An observable of drag movements.
 @param {List<number[]>} initStroke - Initial stroke.
 @returns {Observable} An observable on the gesture drawing.
 */
export default function draw(drag$, { initStroke = [], type = undefined }) {
  const typeOptions = type === undefined ? {} : { type };
  return drag$.pipe(
    scan(
      (acc, notification) => ({
        stroke: [...acc.stroke, notification.position],
        ...typeOptions,
        ...notification,
      }),
      { stroke: initStroke },
    ),
  );
}
