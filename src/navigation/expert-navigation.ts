import { merge, type Observable } from 'rxjs';
import { startWith, last, map, share } from 'rxjs/operators';
import { draw } from '../move/index.js';
import recognize from '../recognizer/index.js';
import type { MarkingMenuModelItem } from '../types.js';
import type { Point } from '../utils.js';

/**
 A drag notification consumed by the navigation: it carries at least a pixel
 position. Extra fields (timeStamp, originalEvent, …) are threaded through
 unchanged.
 */
export type NavigationDrag = { position: Point };

/**
 A drawing notification: a drag notification augmented with the stroke drawn so
 far.
 */
export type DrawNotification<D> = D & { stroke: Point[]; type?: string };

/**
 The notifications emitted by the expert navigation.
 */
export type ExpertNavigationNotification<D> =
  | DrawNotification<D>
  | { type: 'cancel' }
  | (DrawNotification<D> & {
      type: 'select';
      selection: MarkingMenuModelItem;
    })
  | (DrawNotification<D> & { type: 'cancel' });

/**
 Navigate the menu in expert mode: recognize the gesture drawn during the drag.

 @param drag$ - An observable of drag movements.
 @param model - The model of the menu.
 @param initStroke - Initial stroke.
 @returns An observable on the gesture drawing and recognition.
 */
export default function expertNavigation<D extends NavigationDrag>(
  drag$: Observable<D>,
  model: MarkingMenuModelItem,
  initStroke: Point[] = [],
): Observable<ExpertNavigationNotification<D>> {
  // Observable on gesture drawing.
  const draw$ = draw(drag$, { initStroke, type: 'draw' }).pipe(share());

  // Track the end of the drawing and attempt to recognize the gesture.
  const end$ = draw$.pipe(
    startWith(null),
    last(),
    map((event_): ExpertNavigationNotification<D> => {
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
