import { scan } from 'rxjs/operators';

/**
 * Augment a drag$ observable so that events also include the stroke.
 * @param {Observable} drag$ - An observable of drag movements.
 * @param {List<number[]>} initStroke - Initial stroke.
 * @return {Observable} An observable on the gesture drawing.
 */
export default (drag$, { initStroke = [], type = undefined }) => {
  const typeOpts = type === undefined ? {} : { type };
  return drag$.pipe(
    scan(
      (acc, notification) => ({
        stroke: [...acc.stroke, notification.position],
        ...typeOpts,
        ...notification
      }),
      { stroke: initStroke }
    )
  );
};
