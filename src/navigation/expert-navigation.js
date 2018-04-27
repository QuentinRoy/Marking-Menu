import { merge } from 'rxjs';
import { scan, share, startWith, last, map } from 'rxjs/operators';
import recognize from '../recognizer';

/**
 * @param {Observable} drag$ - An observable of drag movements.
 * @param {MMItem} model - The model of the menu.
 * @param {List<number[]>} initStroke - Initial stroke.
 * @return {Observable} An observable on the gesture drawing and recognition.
 */
export default (drag$, model, initStroke = []) => {
  // Observable on gesture drawing.
  const draw$ = drag$.pipe(
    scan(
      (acc, notification) => ({
        stroke: [...acc.stroke, notification.position],
        type: 'draw',
        ...notification
      }),
      { stroke: initStroke }
    ),
    share()
  );
  // Track the end of the drawing and attempt to recognize the gesture.
  const end$ = draw$.pipe(
    startWith(null),
    last(),
    map(e => {
      if (!e) return { type: 'cancel' };
      const selection = recognize(e.stroke, model);
      if (selection) {
        return { ...e, type: 'select', selection };
      }
      return { ...e, type: 'cancel' };
    })
  );
  return merge(draw$, end$);
};
