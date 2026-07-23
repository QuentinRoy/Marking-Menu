import { merge } from 'rxjs';
import { startWith, last, map, share } from 'rxjs/operators';
import { draw } from '../move/index.js';
import recognize from '../recognizer/index.js';

/**
 Navigate the menu in expert mode: recognize the gesture drawn during the drag.

 @param {Observable} drag$ - An observable of drag movements.
 @param {MMItem} model - The model of the menu.
 @param {List<number[]>} initStroke - Initial stroke.
 @returns {Observable} An observable on the gesture drawing and recognition.
 */
export default function expertNavigation(drag$, model, initStroke = []) {
  // Observable on gesture drawing.
  const draw$ = draw(drag$, { initStroke, type: 'draw' }).pipe(share());

  // Track the end of the drawing and attempt to recognize the gesture.
  const end$ = draw$.pipe(
    startWith(null),
    last(),
    map((event_) => {
      if (!event_) {
        return { type: 'cancel' };
      }

      const selection = recognize(event_.stroke, model);
      if (selection) {
        return { ...event_, type: 'select', selection };
      }

      return { ...event_, type: 'cancel' };
    }),
  );
  return merge(draw$, end$);
}
